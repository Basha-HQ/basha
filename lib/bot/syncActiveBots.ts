/**
 * Background sync for active Recall.ai bots.
 *
 * The Recall.ai webhook is the primary trigger for pipeline kickoff, and the
 * per-meeting `GET /api/bots/:id` poller (rendered by MeetingStatusPoller) is
 * the secondary safety net. But both require the user to either (a) have a
 * working webhook or (b) navigate INTO a specific meeting's detail page.
 *
 * Users have reported needing to manually click into a meeting card before
 * transcription would start — that's a UX bug. This function provides the
 * tertiary safety net: a server-side sweep that runs whenever the user opens
 * the dashboard or meetings list (and every 10s while the dashboard poller
 * runs), so processing kicks off without requiring a click on the card.
 *
 * Safety: uses the same atomic CAS as the webhook + per-bot poller. Pipeline
 * is fired-and-forgotten via `after()` so this never blocks a request.
 */

import { after } from 'next/server';
import { query, queryOne } from '@/lib/db';
import {
  getBot as getRecallBot,
  getLatestStatus,
  mapRecallStatus,
} from '@/lib/recall/client';
import { handleRecordingReady, type BotRow } from '@/lib/bot/pipeline';

interface ActiveBotRow extends BotRow {
  user_id: string;
  meeting_status: string;
}

/**
 * Find every bot belonging to `userId` whose meeting is still in a non-terminal
 * state, sync each with Recall.ai, and trigger the pipeline for any whose
 * recording is ready. Idempotent — safe to call repeatedly.
 *
 * This function intentionally does NOT throw: it logs and continues so a
 * single bad bot can't poison the sweep for the rest.
 */
export async function syncActiveBotsForUser(userId: string): Promise<void> {
  let bots: ActiveBotRow[];
  try {
    bots = await query<ActiveBotRow>(
      `SELECT b.id, b.meeting_id, b.meeting_url, b.recall_bot_id, b.status, b.error,
              b.created_at, b.updated_at,
              m.user_id, m.status AS meeting_status
       FROM bots b
       JOIN meetings m ON m.id = b.meeting_id
       WHERE m.user_id = $1
         AND m.status NOT IN ('completed', 'failed')
         AND b.recall_bot_id IS NOT NULL`,
      [userId]
    );
  } catch (err) {
    console.error('[syncActiveBots] DB query failed:', err);
    return;
  }

  if (bots.length === 0) return;
  console.log(`[syncActiveBots] Sweeping ${bots.length} active bot(s) for user ${userId}`);

  await Promise.all(bots.map((bot) => syncOne(bot).catch((err) => {
    console.error(`[syncActiveBots] Bot ${bot.id} sync failed:`, err);
  })));
}

async function syncOne(bot: ActiveBotRow): Promise<void> {
  if (!bot.recall_bot_id) return;

  const recallBot = await getRecallBot(bot.recall_bot_id);
  const recallStatus = getLatestStatus(recallBot);
  const mappedStatus = mapRecallStatus(recallStatus);

  if (mappedStatus === 'done') {
    // Atomic CAS keyed off MEETING status — succeeds at-most-once across
    // racing webhook / per-bot poll / this sweep.
    const claimed = await queryOne<{ id: string }>(
      `UPDATE bots SET status = 'processing', updated_at = NOW()
       WHERE id = $1
         AND meeting_id IN (
           SELECT id FROM meetings WHERE status NOT IN ('processing', 'completed', 'failed')
         )
       RETURNING id`,
      [bot.id]
    );

    if (claimed) {
      console.log(`[syncActiveBots] Claimed bot ${bot.id} — firing pipeline in background`);
      after(async () => {
        try {
          await handleRecordingReady(bot, recallBot, bot.user_id);
        } catch (err) {
          console.error(`[syncActiveBots] Pipeline error for meeting ${bot.meeting_id}:`, err);
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
    return;
  }

  if (mappedStatus === 'failed') {
    const errorMsg = recallBot.status_changes?.at(-1)?.message ?? 'Bot failed';
    await query(
      `UPDATE bots SET status = 'failed', error = $1, updated_at = NOW() WHERE id = $2`,
      [errorMsg, bot.id]
    );
    await query(
      `UPDATE meetings SET status = 'failed', processing_stage = NULL WHERE id = $1`,
      [bot.meeting_id]
    );
    return;
  }

  // Non-terminal status drift — keep DB in sync so the UI reflects reality.
  if (mappedStatus !== bot.status) {
    await query(
      `UPDATE bots SET status = $1, updated_at = NOW() WHERE id = $2`,
      [mappedStatus, bot.id]
    );
  }
}
