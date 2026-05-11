/**
 * GET /api/cron/auto-join
 *
 * Vercel Cron entry point — runs every minute (see vercel.json `crons`).
 * Two-pass sweep:
 *   1. Refresh `calendar_meeting_intents` from Google Calendar for users
 *      whose `last_calendar_sync` is older than 5 minutes.
 *   2. Find intents starting within the next 2 minutes that haven't yet had a
 *      bot launched, and create the bot. Idempotent via the `bot_launched`
 *      flag — overlapping cron invocations are safe.
 *
 * Auth: Vercel Cron sets the `authorization: Bearer <CRON_SECRET>` header
 * automatically when `CRON_SECRET` is configured in the project's env. This
 * route also accepts the same secret as a `?secret=` query param for manual
 * testing during dev. In production we require the header.
 */

import { NextRequest, NextResponse } from 'next/server';
import { query, queryOne } from '@/lib/db';
import { syncCalendarIntents } from '@/lib/calendar/syncIntents';
import { createBot as createRecallBot } from '@/lib/recall/client';

export const dynamic = 'force-dynamic';
export const maxDuration = 60; // seconds — bot creation is API-bound, fast

interface UserRow {
  id: string;
  bot_display_name: string | null;
  meeting_platform: string;
  auto_join_mode: string;
}

interface PendingIntent {
  id: string;
  user_id: string;
  calendar_event_id: string;
  meeting_url: string;
  scheduled_start: Date;
}

function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    // No secret configured → in production this should fail closed; in dev
    // we allow direct hits so a developer can poke /api/cron/auto-join.
    return process.env.NODE_ENV !== 'production';
  }
  const header = req.headers.get('authorization') ?? '';
  if (header === `Bearer ${secret}`) return true;
  const qp = req.nextUrl.searchParams.get('secret') ?? '';
  return qp === secret;
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const startedAt = Date.now();

  // ── Pass 1: refresh calendar intents for any user whose cache is stale ────
  // Limit to users with auto_join_mode != 'off' AND a connected calendar.
  // Users with auto_join_mode='off' can still toggle individual meetings, but
  // they don't need the cron to sync; their UI fetches fresh data on demand.
  const usersToSync = await query<{ id: string }>(
    `SELECT id FROM users
     WHERE google_calendar_connected = true
       AND auto_join_mode != 'off'
       AND (last_calendar_sync IS NULL
            OR last_calendar_sync < NOW() - INTERVAL '5 minutes')
     LIMIT 50`
  );

  const syncResults: Array<{ userId: string; synced: boolean; count: number }> = [];
  for (const u of usersToSync) {
    try {
      const r = await syncCalendarIntents(u.id);
      syncResults.push({ userId: u.id, ...r });
    } catch (err) {
      console.error(`[cron/auto-join] sync failed for ${u.id}:`, err instanceof Error ? err.message : err);
    }
  }

  // ── Pass 2: launch bots for intents starting in the next 2 minutes ────────
  // Window: [now, now+2min]. Lead time gives the bot a chance to be in the
  // waiting room when the host actually opens the meeting.
  const pending = await query<PendingIntent>(
    `SELECT i.id, i.user_id, i.calendar_event_id, i.meeting_url, i.scheduled_start
     FROM calendar_meeting_intents i
     JOIN users u ON u.id = i.user_id
     WHERE i.should_record = true
       AND i.bot_launched = false
       AND u.auto_join_mode != 'off'
       AND i.scheduled_start IS NOT NULL
       AND i.scheduled_start <= NOW() + INTERVAL '6 minutes'
       AND i.scheduled_start >  NOW() - INTERVAL '5 minutes'
     ORDER BY i.scheduled_start ASC
     LIMIT 20`
  );

  const launches: Array<{ intentId: string; meetingId: string | null; error?: string }> = [];

  for (const intent of pending) {
    try {
      const user = await queryOne<UserRow>(
        `SELECT id, bot_display_name, meeting_platform, auto_join_mode FROM users WHERE id = $1`,
        [intent.user_id]
      );
      if (!user) continue;

      // Platform gate
      const url = intent.meeting_url;
      const isMeet = url.includes('meet.google.com');
      const isZoom = url.includes('zoom.us');
      const isTeams = url.includes('teams.microsoft.com') || url.includes('teams.live.com');
      const isWebex = url.includes('webex.com');
      if (user.meeting_platform === 'google_meet' && !isMeet) continue;
      if (user.meeting_platform === 'zoom' && !isZoom) continue;
      if (!isMeet && !isZoom && !isTeams && !isWebex) continue; // unsupported URL

      let platform: 'google_meet' | 'zoom' | 'other' = 'other';
      if (isMeet) platform = 'google_meet';
      else if (isZoom) platform = 'zoom';

      // Atomic claim — flip bot_launched to true with the row still locked
      // to the original (false) value. If two cron runs race, only one wins.
      const claimed = await queryOne<{ id: string }>(
        `UPDATE calendar_meeting_intents
         SET bot_launched = true
         WHERE id = $1 AND bot_launched = false
         RETURNING id`,
        [intent.id]
      );
      if (!claimed) {
        // Another cron tick already claimed this — skip
        continue;
      }

      // Create the meeting record
      const meeting = await queryOne<{ id: string }>(
        `INSERT INTO meetings (user_id, meeting_link, title, status, platform, source_language, output_language, recorder_type)
         VALUES ($1, $2, $3, 'recording', $4, 'auto', 'en', 'bot')
         RETURNING id`,
        [intent.user_id, intent.meeting_url, 'Scheduled meeting', platform]
      );
      if (!meeting) throw new Error('Failed to create meeting record');

      // Launch the Recall.ai bot. Webhook is registered when NEXTAUTH_URL is
      // public HTTPS; otherwise we rely on polling (handled by GET /api/bots/:id).
      const baseUrl = process.env.NEXTAUTH_URL ?? '';
      const isPublic = baseUrl.startsWith('https://');
      const webhookUrl = isPublic ? `${baseUrl}/api/webhooks/recall` : undefined;
      const botName = user.bot_display_name?.trim() || 'Basha Notetaker';

      const recallBot = await createRecallBot(intent.meeting_url, botName, webhookUrl);

      const bot = await queryOne<{ id: string }>(
        `INSERT INTO bots (meeting_id, meeting_url, recall_bot_id, status)
         VALUES ($1, $2, $3, 'joining')
         RETURNING id`,
        [meeting.id, intent.meeting_url, recallBot.id]
      );
      if (!bot) throw new Error('Failed to create bot record');

      await query(
        `UPDATE calendar_meeting_intents SET meeting_id = $1 WHERE id = $2`,
        [meeting.id, intent.id]
      );

      launches.push({ intentId: intent.id, meetingId: meeting.id });
      console.log(`[cron/auto-join] Launched bot ${recallBot.id} for intent ${intent.id} (meeting ${meeting.id})`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      // Reset bot_launched so the next cron tick can retry — but only for
      // transient errors. Recall.ai 4xx (bad URL) is permanent; mark as failed.
      const isTransient = /5\d\d|fetch|network|timeout/i.test(msg);
      if (isTransient) {
        await query(
          `UPDATE calendar_meeting_intents SET bot_launched = false WHERE id = $1`,
          [intent.id]
        ).catch(() => {});
      }
      launches.push({ intentId: intent.id, meetingId: null, error: msg });
      console.error(`[cron/auto-join] Launch failed for intent ${intent.id}:`, msg);
    }
  }

  return NextResponse.json({
    elapsedMs: Date.now() - startedAt,
    syncedUsers: syncResults.filter((r) => r.synced).length,
    intentsRefreshed: syncResults.reduce((sum, r) => sum + r.count, 0),
    launches,
  });
}
