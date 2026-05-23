/**
 * GET    /api/bots/:id  — poll bot status (syncs with Recall.ai)
 * DELETE /api/bots/:id  — remove bot from meeting
 */

import { NextRequest, NextResponse } from 'next/server';
import { after } from 'next/server';
import { auth } from '@/lib/auth/config';
import { queryOne, query } from '@/lib/db';

export const maxDuration = 300;
import {
  getBot as getRecallBot,
  deleteBot as deleteRecallBot,
  getLatestStatus,
  mapRecallStatus,
} from '@/lib/recall/client';
import { handleRecordingReady, type BotRow } from '@/lib/bot/pipeline';
import { sendBotFailureEmail } from '@/lib/email';

// ── GET — poll status ─────────────────────────────────────────────────────────

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  const bot = await queryOne<BotRow & { user_id: string }>(
    `SELECT b.id, b.meeting_id, b.meeting_url, b.recall_bot_id, b.status, b.error, b.created_at, b.updated_at,
            m.user_id
     FROM bots b
     JOIN meetings m ON m.id = b.meeting_id
     WHERE b.id = $1 AND m.user_id = $2`,
    [id, session.user.id]
  );

  if (!bot) {
    return NextResponse.json({ error: 'Bot not found' }, { status: 404 });
  }

  // If bot is still active, sync status from Recall.ai
  // Exclude 'processing' to prevent double-triggering handleRecordingReady
  if (bot.recall_bot_id && !['completed', 'failed', 'processing'].includes(bot.status)) {
    try {
      const recallBot = await getRecallBot(bot.recall_bot_id);
      const recallStatus = getLatestStatus(recallBot);
      const mappedStatus = mapRecallStatus(recallStatus);

      if (mappedStatus === 'done') {
        // ── Polling-fallback auto-trigger ─────────────────────────────────────
        // Primary trigger is the Recall.ai webhook (Svix). This is the safety net
        // for environments where the webhook is misconfigured, delayed, or fails
        // signature verification — guarantees the pipeline runs end-to-end without
        // any user interaction.
        //
        // Atomic CAS: only the first caller to flip the row to 'processing' runs
        // the pipeline. The webhook path uses the same guard, so even if both
        // race, exactly one wins.
        const claimed = await queryOne<{ id: string }>(
          `UPDATE bots SET status = 'processing', updated_at = NOW()
           WHERE id = $1 AND status NOT IN ('processing', 'completed', 'failed')
           RETURNING id`,
          [bot.id]
        );
        bot.status = 'processing';

        if (claimed) {
          console.log(`[api/bots] Polling-fallback claimed bot ${bot.id} — running pipeline in background`);
          after(async () => {
            try {
              await handleRecordingReady(bot, recallBot, bot.user_id);
            } catch (err) {
              console.error(`[api/bots] Pipeline error for meeting ${bot.meeting_id}:`, err);
              await query(
                `UPDATE bots SET status = 'failed', error = $1, updated_at = NOW() WHERE id = $2`,
                [String(err), bot.id]
              ).catch(console.error);
              await query(
                `UPDATE meetings SET status = 'failed', processing_stage = NULL WHERE id = $1`,
                [bot.meeting_id]
              ).catch(console.error);
            }
          });
        }
      } else if (mappedStatus === 'failed') {
        const errorMsg = recallBot.status_changes?.at(-1)?.message ?? 'Bot failed';
        await query(
          `UPDATE bots SET status = 'failed', error = $1, updated_at = NOW() WHERE id = $2`,
          [errorMsg, bot.id]
        );
        await query(
          `UPDATE meetings SET status = 'failed' WHERE id = $1`,
          [bot.meeting_id]
        );
        bot.status = 'failed';
        bot.error = errorMsg;

        // Notify user — fire-and-forget so it doesn't block the response
        const userRow = await queryOne<{ email: string; name: string; title: string }>(
          `SELECT u.email, u.name, m.title FROM users u JOIN meetings m ON m.user_id = u.id WHERE m.id = $1`,
          [bot.meeting_id]
        ).catch(() => null);
        if (userRow) {
          sendBotFailureEmail(userRow.email, userRow.name, userRow.title ?? 'Your Meeting', errorMsg)
            .catch(console.error);
        }
      } else if (mappedStatus !== bot.status) {
        // Status changed — update DB
        await query(
          `UPDATE bots SET status = $1, updated_at = NOW() WHERE id = $2`,
          [mappedStatus, bot.id]
        );
        bot.status = mappedStatus;
      }
    } catch (err) {
      // Recall.ai API error — return cached DB status, don't crash
      console.error('[api/bots] Recall.ai sync error:', err);
    }
  }

  return NextResponse.json({ bot });
}

// ── DELETE — stop bot ─────────────────────────────────────────────────────────

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  const bot = await queryOne<BotRow>(
    `SELECT b.id, b.meeting_id, b.recall_bot_id, b.status, b.error, b.meeting_url, b.created_at, b.updated_at
     FROM bots b
     JOIN meetings m ON m.id = b.meeting_id
     WHERE b.id = $1 AND m.user_id = $2`,
    [id, session.user.id]
  );

  if (!bot) {
    return NextResponse.json({ error: 'Bot not found' }, { status: 404 });
  }

  // Tell Recall.ai to remove the bot from the meeting
  if (bot.recall_bot_id) {
    try {
      await deleteRecallBot(bot.recall_bot_id);
    } catch {
      // Bot may have already left — that's fine
    }
  }

  await query(
    `UPDATE bots SET status = 'failed', error = 'Stopped by user', updated_at = NOW() WHERE id = $1`,
    [id]
  );

  // Also update the meeting status so it doesn't stay stuck on 'recording'
  await query(
    `UPDATE meetings SET status = 'failed' WHERE id = (SELECT meeting_id FROM bots WHERE id = $1)`,
    [id]
  );

  return NextResponse.json({ success: true });
}
