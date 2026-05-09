/**
 * Periodic refresh of `calendar_meeting_intents` from Google Calendar.
 *
 * Why this exists: the auto-join cron only sees intents that already live in
 * our DB. Without this sync, brand-new calendar events created after the user
 * connected Calendar would never get picked up. This module is invoked by the
 * cron route and rate-limits itself to once-per-5-minutes per user via
 * `users.last_calendar_sync`.
 */

import { query, queryOne } from '@/lib/db';
import { getValidAccessToken } from './token';

interface CalendarEvent {
  id?: string;
  summary?: string;
  hangoutLink?: string;
  description?: string;
  organizer?: { email?: string; self?: boolean };
  start?: { dateTime?: string; date?: string };
}

const SYNC_TTL_MS = 5 * 60 * 1000; // 5 minutes

function extractMeetingUrl(event: CalendarEvent): string | null {
  if (event.hangoutLink) return event.hangoutLink;
  const desc = event.description ?? '';
  const m = desc.match(/https?:\/\/[^\s<"']*(meet\.google\.com|zoom\.us|teams\.(?:microsoft|live)\.com)[^\s<"']*/i);
  return m ? m[0] : null;
}

/**
 * Refresh intents for one user from their primary Google Calendar. Returns
 * { synced: boolean, count: number } where synced=false means the user has no
 * Calendar connection or the sync was rate-limited (TTL not yet elapsed).
 */
export async function syncCalendarIntents(userId: string, force = false): Promise<{ synced: boolean; count: number }> {
  // Rate-limit: skip if the user was synced within the TTL window
  if (!force) {
    const last = await queryOne<{ last_calendar_sync: Date | null }>(
      `SELECT last_calendar_sync FROM users WHERE id = $1`,
      [userId]
    );
    const lastMs = last?.last_calendar_sync ? new Date(last.last_calendar_sync).getTime() : 0;
    if (Date.now() - lastMs < SYNC_TTL_MS) {
      return { synced: false, count: 0 };
    }
  }

  const token = await getValidAccessToken(userId);
  if (!token) return { synced: false, count: 0 };

  // User's auto-join mode determines the default `should_record` for new
  // intents. 'all' → record every meeting; 'organizer_only' → only when the
  // user is the organizer; 'off' → don't auto-record (user can still toggle).
  const userPrefs = await queryOne<{ auto_join_mode: string; meeting_platform: string }>(
    `SELECT auto_join_mode, meeting_platform FROM users WHERE id = $1`,
    [userId]
  );
  const autoJoinMode = userPrefs?.auto_join_mode ?? 'off';
  const platformFilter = userPrefs?.meeting_platform ?? 'both';

  const now = new Date().toISOString();
  const weekLater = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  const calRes = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events?` +
      new URLSearchParams({
        timeMin: now,
        timeMax: weekLater,
        maxResults: '50',
        singleEvents: 'true',
        orderBy: 'startTime',
      }),
    { headers: { Authorization: `Bearer ${token}` } }
  );

  if (!calRes.ok) {
    // Mark synced so we don't retry for 5 minutes — Google API hiccups recover on next sweep
    await query(`UPDATE users SET last_calendar_sync = NOW() WHERE id = $1`, [userId]);
    return { synced: false, count: 0 };
  }

  const data = (await calRes.json()) as { items?: CalendarEvent[] };
  const events = data.items ?? [];

  let upserted = 0;
  for (const event of events) {
    if (!event.id) continue;
    const meetingUrl = extractMeetingUrl(event);
    if (!meetingUrl) continue;

    // Platform filter — skip events on platforms the user disabled
    if (platformFilter === 'google_meet' && !meetingUrl.includes('meet.google.com')) continue;
    if (platformFilter === 'zoom' && !meetingUrl.includes('zoom.us')) continue;

    const startIso = event.start?.dateTime ?? event.start?.date ?? null;

    // Decide should_record default for this event:
    //   off            → false (user must toggle on)
    //   all            → true
    //   organizer_only → true only if event.organizer.self is true
    let shouldRecordDefault: boolean;
    if (autoJoinMode === 'all') shouldRecordDefault = true;
    else if (autoJoinMode === 'organizer_only') shouldRecordDefault = !!event.organizer?.self;
    else shouldRecordDefault = false;

    // Upsert: do NOT clobber should_record on existing rows — user toggles win.
    // Only set should_record on INSERT.
    await query(
      `INSERT INTO calendar_meeting_intents
         (user_id, calendar_event_id, meeting_url, scheduled_start, should_record)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (user_id, calendar_event_id)
       DO UPDATE SET
         meeting_url     = EXCLUDED.meeting_url,
         scheduled_start = EXCLUDED.scheduled_start`,
      [userId, event.id, meetingUrl, startIso, shouldRecordDefault]
    );
    upserted++;
  }

  await query(`UPDATE users SET last_calendar_sync = NOW() WHERE id = $1`, [userId]);
  return { synced: true, count: upserted };
}
