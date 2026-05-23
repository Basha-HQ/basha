/**
 * POST /api/webhooks/recall — Recall.ai webhook receiver
 *
 * Recall.ai (via Svix) fires granular events when a bot transitions state.
 * We listen for two:
 *   - bot.done    → recording is ready to download → run the pipeline
 *   - bot.fatal   → bot died → mark meeting failed + notify user
 *
 * All other events are accepted and ignored (so the 200 response prevents
 * Svix retries).
 *
 * RECALL_WEBHOOK_SECRET must be set to the `whsec_...` secret shown in the
 * Recall.ai dashboard for this endpoint. The signature is verified using
 * Svix's standard scheme (svix-id, svix-timestamp, svix-signature headers).
 */

import { NextRequest, NextResponse } from 'next/server';
import { after } from 'next/server';
import { Webhook, WebhookVerificationError } from 'svix';
import { queryOne, query } from '@/lib/db';
import { getBot as getRecallBot } from '@/lib/recall/client';
import { handleRecordingReady, type BotRow } from '@/lib/bot/pipeline';
import { sendBotFailureEmail } from '@/lib/email';

export const maxDuration = 300;

type RecallWebhookPayload = {
  event: string;
  data?: {
    bot?: { id?: string };
  };
};

export async function POST(req: NextRequest) {
  const secret = process.env.RECALL_WEBHOOK_SECRET;
  if (!secret) {
    console.error('[webhook/recall] RECALL_WEBHOOK_SECRET is not configured — rejecting request');
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Svix verifies against the EXACT raw body bytes — must read text before JSON.parse
  const rawBody = await req.text();
  const svixHeaders = {
    'svix-id': req.headers.get('svix-id') ?? '',
    'svix-timestamp': req.headers.get('svix-timestamp') ?? '',
    'svix-signature': req.headers.get('svix-signature') ?? '',
  };

  let payload: RecallWebhookPayload;
  try {
    const wh = new Webhook(secret);
    payload = wh.verify(rawBody, svixHeaders) as RecallWebhookPayload;
  } catch (err) {
    if (err instanceof WebhookVerificationError) {
      console.warn('[webhook/recall] Svix signature verification failed:', err.message);
    } else {
      console.warn('[webhook/recall] Webhook verification error:', err);
    }
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  const eventName = payload.event;
  const recallBotId = payload.data?.bot?.id;

  if (!eventName || !recallBotId) {
    return NextResponse.json({ error: 'Missing event or bot id' }, { status: 400 });
  }

  console.log(`[webhook/recall] event=${eventName} recall_bot_id=${recallBotId}`);

  // Only act on bot.done and bot.fatal — everything else just acks
  if (eventName !== 'bot.done' && eventName !== 'bot.fatal') {
    return NextResponse.json({ ok: true });
  }

  const bot = await queryOne<BotRow & { user_id: string }>(
    `SELECT b.id, b.meeting_id, b.meeting_url, b.recall_bot_id, b.status, b.error, b.created_at, b.updated_at,
            m.user_id
     FROM bots b
     JOIN meetings m ON m.id = b.meeting_id
     WHERE b.recall_bot_id = $1`,
    [recallBotId]
  );

  if (!bot) {
    console.warn(`[webhook/recall] No bot found for recall_bot_id=${recallBotId}`);
    return NextResponse.json({ ok: true });
  }

  if (eventName === 'bot.done') {
    // Atomic CAS — only the first request to claim this row runs the pipeline.
    // Guards against the webhook + polling path racing each other.
    const claimed = await queryOne<{ id: string }>(
      `UPDATE bots SET status = 'processing', updated_at = NOW()
       WHERE id = $1 AND status NOT IN ('processing', 'completed', 'failed')
       RETURNING id`,
      [bot.id]
    );

    if (!claimed) {
      console.log(`[webhook/recall] Bot ${bot.id} already claimed by another path — skipping`);
      return NextResponse.json({ ok: true });
    }

    // Fetch full Recall.ai bot (needed for recordings array) before responding
    let recallBot;
    try {
      recallBot = await getRecallBot(recallBotId);
    } catch (err) {
      console.error('[webhook/recall] Failed to fetch Recall.ai bot:', err);
      await query(
        `UPDATE bots SET status = 'failed', error = $1, updated_at = NOW() WHERE id = $2`,
        [String(err), bot.id]
      );
      await query(`UPDATE meetings SET status = 'failed' WHERE id = $1`, [bot.meeting_id]);
      return NextResponse.json({ error: 'Recall.ai fetch failed' }, { status: 500 });
    }

    // Fire-and-forget — Recall.ai gets a 200 immediately, pipeline runs in background
    after(async () => {
      try {
        await handleRecordingReady(bot, recallBot!, bot.user_id);
      } catch (err) {
        console.error(`[webhook/recall] Pipeline error for meeting ${bot.meeting_id}:`, err);
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

    return NextResponse.json({ ok: true });
  }

  // bot.fatal
  if (['completed', 'failed'].includes(bot.status)) {
    return NextResponse.json({ ok: true });
  }

  const errorMsg = `Recall.ai bot ${eventName}`;
  await query(
    `UPDATE bots SET status = 'failed', error = $1, updated_at = NOW() WHERE id = $2`,
    [errorMsg, bot.id]
  );
  await query(
    `UPDATE meetings SET status = 'failed', processing_stage = NULL WHERE id = $1`,
    [bot.meeting_id]
  );

  // Notify user — fire-and-forget
  const userRow = await queryOne<{ email: string; name: string; title: string }>(
    `SELECT u.email, u.name, m.title FROM users u JOIN meetings m ON m.user_id = u.id WHERE m.id = $1`,
    [bot.meeting_id]
  ).catch(() => null);
  if (userRow) {
    sendBotFailureEmail(userRow.email, userRow.name, userRow.title ?? 'Your Meeting', errorMsg)
      .catch(console.error);
  }

  console.log(`[webhook/recall] Marked bot ${bot.id} and meeting ${bot.meeting_id} as failed`);
  return NextResponse.json({ ok: true });
}
