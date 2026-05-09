/**
 * Google OAuth access-token helpers shared across the calendar / bot routes
 * and the auto-join cron. Refreshes the token via the stored refresh_token
 * when it's near expiry (5-min buffer), persists the new access token, and
 * returns the value the caller should use for the next API call.
 *
 * Returns null when:
 *   - the user hasn't connected Calendar
 *   - the refresh token is missing or revoked
 */

import { query, queryOne } from '@/lib/db';

export interface CalendarTokenRow {
  google_access_token: string | null;
  google_refresh_token: string | null;
  google_token_expiry: Date | null;
  google_calendar_connected: boolean;
}

/**
 * Exchange a refresh token for a new access token. Persists on success.
 * Returns null if Google rejects the refresh (revoked / invalid token).
 */
export async function refreshAccessToken(refreshToken: string, userId: string): Promise<string | null> {
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
  const data = (await res.json()) as { access_token?: string };
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

/**
 * Return a usable Google Calendar access token for the user, refreshing when
 * within 5 minutes of expiry. Returns null if Calendar is not connected
 * or the token can't be refreshed (caller should treat as "skip Calendar").
 */
export async function getValidAccessToken(userId: string): Promise<string | null> {
  const user = await queryOne<CalendarTokenRow>(
    `SELECT google_access_token, google_refresh_token, google_token_expiry, google_calendar_connected
     FROM users WHERE id = $1`,
    [userId]
  );
  if (!user?.google_calendar_connected || !user.google_access_token) return null;

  const expiryMs = user.google_token_expiry ? new Date(user.google_token_expiry).getTime() : 0;
  const isExpiring = Date.now() >= expiryMs - 5 * 60 * 1000;

  if (isExpiring && user.google_refresh_token) {
    const refreshed = await refreshAccessToken(user.google_refresh_token, userId);
    return refreshed;
  }
  return user.google_access_token;
}
