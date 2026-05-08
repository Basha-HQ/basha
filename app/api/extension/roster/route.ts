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
import { queryOne, query } from '@/lib/db';

interface CalendarUser {
  name: string | null;
  google_access_token: string | null;
  google_refresh_token: string | null;
  google_token_expiry: Date | null;
  google_calendar_connected: boolean;
}

async function getRefreshedToken(refreshToken: string, userId: string): Promise<string | null> {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });
  if (!res.ok) return null;
  const data = await res.json() as { access_token?: string };
  const newToken = data.access_token ?? null;
  if (newToken) {
    const newExpiry = new Date(Date.now() + 3600 * 1000).toISOString();
    await query(
      'UPDATE users SET google_access_token = $1, google_token_expiry = $2 WHERE id = $3',
      [newToken, newExpiry, userId]
    );
  }
  return newToken;
}

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

  const user = await queryOne<CalendarUser>(
    `SELECT name, google_access_token, google_refresh_token, google_token_expiry, google_calendar_connected
     FROM users WHERE id = $1`,
    [userId]
  );

  const selfName = (user?.name ?? '').trim() || null;

  // Calendar overlay is best-effort. Without OAuth we still return selfName.
  if (!user?.google_calendar_connected || !user.google_access_token) {
    return NextResponse.json({ selfName, calendarAttendees: null });
  }

  // Refresh access token if expired (5-min buffer)
  let token = user.google_access_token;
  const expiry = user.google_token_expiry ? new Date(user.google_token_expiry).getTime() : 0;
  if (Date.now() >= expiry - 5 * 60 * 1000 && user.google_refresh_token) {
    const refreshed = await getRefreshedToken(user.google_refresh_token, userId);
    if (!refreshed) {
      return NextResponse.json({ selfName, calendarAttendees: null });
    }
    token = refreshed;
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
