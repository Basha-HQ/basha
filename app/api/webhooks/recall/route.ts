/**
 * POST /api/webhooks/recall — Recall.ai webhook receiver
 *
 * Recall.ai calls this endpoint when a bot's status changes.
 * This allows the pipeline to run server-side without needing an active browser tab.
 *
 * Set RECALL_WEBHOOK_SECRET in .env.local for signature verification (recommended in prod).
 *
 * Recall.ai webhook payload:
 * {
 *   "event": "bot.status_change",
 *   "data": {
 *     "bot": {
 *       "id": "<recall_bot_id>",
 *       "status": { "code": "done" | "fatal" | ... }
 *     }
 *   }
 * }
 */

import { NextRequest, NextResponse, after } from 'next/server';
import { queryOne, query } from '@/lib/db';
import { getBot as getRecallBot } from '@/lib/recall/client';
import { handleRecordingReady, type BotRow } from '@/lib/bot/pipeline';

export async function POST(req: NextRequest) {
  // Webhook secret verification — required in production
  const secret = process.env.RECALL_WEBHOOK_SECRET;
  if (!secret) {
    console.error('[webhook/recall] RECALL_WEBHOOK_SECRET is not configured — rejecting request');
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const signature = req.headers.get('x-recall-signature') ?? '';
  if (signature !== secret) {
    console.warn('[webhook/recall] Invalid signature — request rejected');
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let payload: {
    event: string;
    data?: {
      bot?: {
        id?: string;
        status?: { code?: string };
      };
    };
  };

  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  // Only handle bot status change events
  if (payload.event !== 'bot.status_change') {
    return NextResponse.json({ ok: true });
  }

  const recallBotId = payload.data?.bot?.id;
  const statusCode = payload.data?.bot?.status?.code;

  if (!recallBotId || !statusCode) {
    return NextResponse.json({ error: 'Missing bot id or status code' }, { status: 400 });
  }

  console.log(`[webhook/recall] event=bot.status_change recall_bot_id=${recallBotId} status=${statusCode}`);

  // Look up our bot by the Recall.ai bot ID
  const bot = await queryOne<BotRow & { user_id: string }>(
    `SELECT b.id, b.meeting_id, b.meeting_url, b.recall_bot_id, b.status, b.error, b.created_at, b.updated_at,
            m.user_id
     FROM bots b
     JOIN meetings m ON m.id = b.meeting_id
     WHERE b.recall_bot_id = $1`,
    [recallBotId]
  );

  if (!bot) {
    // Bot not in our DB — ignore (might be from another environment)
    console.warn(`[webhook/recall] No bot found for recall_bot_id=${recallBotId}`);
    return NextResponse.json({ ok: true });
  }

  if (statusCode === 'done') {
    // Skip if already processing or completed (idempotency guard)
    if (['processing', 'completed'].includes(bot.status)) {
      console.log(`[webhook/recall] Bot ${bot.id} already ${bot.status} — skipping`);
      return NextResponse.json({ ok: true });
    }

    try {
      // Fetch full bot data from Recall.ai (need recordings array for download URL)
      const recallBot = await getRecallBot(recallBotId);
      // Mark as processing before responding so Recall.ai doesn't re-send the webhook
      await query(
        `UPDATE bots SET status = 'processing', updated_at = NOW() WHERE id = $1`,
        [bot.id]
      );
      // Run pipeline after the 200 response — keeps Vercel function alive past the response
      after(
        handleRecordingReady(bot, recallBot, bot.user_id).catch((err) => {
          console.error('[webhook/recall] Pipeline error:', err);
        })
      );
    } catch (err) {
      console.error('[webhook/recall] Setup error:', err);
      return NextResponse.json({ error: 'Pipeline error' }, { status: 500 });
    }
  } else if (statusCode === 'fatal' || statusCode === 'analysis_failed') {
    // Mark bot and meeting as failed if not already terminal
    if (!['completed', 'failed'].includes(bot.status)) {
      const errorMsg = `Recall.ai bot ${statusCode}`;
      await query(
        `UPDATE bots SET status = 'failed', error = $1, updated_at = NOW() WHERE id = $2`,
        [errorMsg, bot.id]
      );
      await query(
        `UPDATE meetings SET status = 'failed' WHERE id = $1`,
        [bot.meeting_id]
      );
      console.log(`[webhook/recall] Marked bot ${bot.id} and meeting ${bot.meeting_id} as failed`);
    }
  }

  return NextResponse.json({ ok: true });
}
