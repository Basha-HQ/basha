/**
 * GET /api/extension/roster?meetingUrl=...
 *
 * Returns the canonical roster for a meeting:
 *   - selfName: the user's own display name (always present, from OAuth profile)
 *   - calendarAttendees: invited attendees from the Google Calendar event whose
 *       hangoutLink (or description URL) matches the given Meet URL.
 *       null when the meeting is unscheduled / not on the user's calendar /
 *       Calendar OAuth not connected — extension simply skips Calendar overlay.
 *
 * The extension uses this at recording start to seed `canonicalRoster`. The
 * People-pane scrape happens client-side regardless; Calendar attendees are
 * an *augmentation* used for canonical-spelling reconciliation, not a primary
 * source. So Calendar failure is silent and non-fatal.
 *
 * Auth: Extension Bearer token.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getExtensionUser } from '@/lib/extension/auth';
import { queryOne } from '@/lib/db';
import { getValidAccessToken } from '@/lib/calendar/token';

function meetCodeFromUrl(url: string): string | null {
  // Google Meet URLs look like https://meet.google.com/abc-defg-hij
  const m = url.match(/meet\.google\.com\/([a-z0-9-]+)/i);
  return m ? m[1].toLowerCase() : null;
}

export async function GET(req: NextRequest) {
  const userId = await getExtensionUser(req.headers.get('authorization'));
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const meetingUrl = req.nextUrl.searchParams.get('meetingUrl') ?? '';

  const user = await queryOne<{ name: string | null }>(
    `SELECT name FROM users WHERE id = $1`,
    [userId]
  );
  const selfName = (user?.name ?? '').trim() || null;

  // Calendar overlay is best-effort. Without OAuth we still return selfName.
  const token = await getValidAccessToken(userId);
  if (!token) {
    return NextResponse.json({ selfName, calendarAttendees: null });
  }

  // Search a window around now for events whose hangoutLink matches.
  // 12-hour window covers same-day meetings while keeping the result list small.
  const windowStart = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString();
  const windowEnd = new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString();

  const calRes = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events?` +
      new URLSearchParams({
        timeMin: windowStart,
        timeMax: windowEnd,
        maxResults: '50',
        singleEvents: 'true',
        orderBy: 'startTime',
      }),
    { headers: { Authorization: `Bearer ${token}` } }
  );

  if (!calRes.ok) {
    return NextResponse.json({ selfName, calendarAttendees: null });
  }

  const calData = await calRes.json() as {
    items?: Array<{
      hangoutLink?: string;
      description?: string;
      attendees?: Array<{ displayName?: string; email?: string }>;
    }>;
  };

  const meetCode = meetCodeFromUrl(meetingUrl);
  const event = (calData.items ?? []).find((e) => {
    const link = e.hangoutLink ?? '';
    if (link && meetingUrl && link.includes(meetingUrl.replace(/^https?:\/\//, '').split('?')[0])) return true;
    if (meetCode && link.toLowerCase().includes(meetCode)) return true;
    if (meetCode && (e.description ?? '').toLowerCase().includes(meetCode)) return true;
    return false;
  });

  if (!event || !Array.isArray(event.attendees) || event.attendees.length === 0) {
    return NextResponse.json({ selfName, calendarAttendees: null });
  }

  // Use displayName when present; else the local-part of the email as a
  // serviceable fallback ("alice.smith@x.com" → "alice.smith").
  const attendees = event.attendees
    .map((a) => {
      const name = (a.displayName ?? '').trim();
      if (name) return name;
      const local = (a.email ?? '').split('@')[0];
      return local ? local.replace(/[._-]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) : '';
    })
    .filter((s): s is string => Boolean(s));

  return NextResponse.json({ selfName, calendarAttendees: attendees });
}
