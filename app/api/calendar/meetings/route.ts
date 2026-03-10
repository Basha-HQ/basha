import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth/config';
import { queryOne, query } from '@/lib/db';

interface CalendarUser {
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

function extractMeetingUrl(text: string): string | null {
  const match = text.match(/https?:\/\/[^\s<"']*(meet\.google\.com|zoom\.us)[^\s<"']*/);
  return match ? match[0] : null;
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const user = await queryOne<CalendarUser>(
    'SELECT google_access_token, google_refresh_token, google_token_expiry, google_calendar_connected FROM users WHERE id = $1',
    [session.user.id]
  );

  if (!user?.google_calendar_connected) {
    return NextResponse.json({ meetings: [], connected: false });
  }

  if (!user.google_access_token) {
    return NextResponse.json({ meetings: [], connected: true, error: 'no_token' });
  }

  // Refresh token if expired (with 5-min buffer)
  let token = user.google_access_token;
  const expiry = user.google_token_expiry ? new Date(user.google_token_expiry).getTime() : 0;
  if (Date.now() >= expiry - 5 * 60 * 1000 && user.google_refresh_token) {
    const refreshed = await getRefreshedToken(user.google_refresh_token, session.user.id);
    if (refreshed) token = refreshed;
  }

  const now = new Date().toISOString();
  const weekLater = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  const calRes = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events?` +
      new URLSearchParams({
        timeMin: now,
        timeMax: weekLater,
        maxResults: '5',
        singleEvents: 'true',
        orderBy: 'startTime',
      }),
    { headers: { Authorization: `Bearer ${token}` } }
  );

  if (!calRes.ok) {
    return NextResponse.json({ meetings: [], connected: true, error: 'calendar_api_error' });
  }

  const calData = await calRes.json() as { items?: Record<string, unknown>[] };
  const meetings = (calData.items ?? []).map((event) => {
    const start = event.start as Record<string, string> | undefined;
    const end = event.end as Record<string, string> | undefined;
    const description = (event.description as string) ?? '';
    return {
      id: event.id as string,
      title: (event.summary as string) || 'Untitled meeting',
      start: start?.dateTime ?? start?.date ?? null,
      end: end?.dateTime ?? end?.date ?? null,
      meetingUrl: (event.hangoutLink as string | undefined) ?? extractMeetingUrl(description),
    };
  });

  return NextResponse.json({ meetings, connected: true });
}
