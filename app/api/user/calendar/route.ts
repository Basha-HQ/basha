/**
 * DELETE /api/user/calendar
 * Disconnect Google Calendar — clears stored OAuth tokens.
 */

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth/config';
import { queryOne } from '@/lib/db';

export async function DELETE() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  await queryOne(
    `UPDATE users
     SET google_calendar_connected = false,
         google_access_token  = NULL,
         google_refresh_token = NULL,
         google_token_expiry  = NULL
     WHERE id = $1`,
    [session.user.id]
  );

  return NextResponse.json({ ok: true });
}
