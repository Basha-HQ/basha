/**
 * POST /api/extension/session
 * Creates a meeting record when the Chrome extension starts recording.
 * Auth: Extension Bearer token.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getExtensionUser } from '@/lib/extension/auth';
import { query } from '@/lib/db';

function detectPlatform(url: string): 'google_meet' | 'zoom' | 'other' {
  if (url.includes('meet.google.com')) return 'google_meet';
  if (url.includes('zoom.us')) return 'zoom';
  return 'other';
}

export async function POST(req: NextRequest) {
  const userId = await getExtensionUser(req.headers.get('authorization'));
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const {
    sourceLanguage = 'auto',
    meetingUrl = '',
    title,
  } = body as {
    sourceLanguage?: string;
    meetingUrl?: string;
    title?: string;
  };

  const platform = detectPlatform(meetingUrl);
  const meetingTitle =
    title ||
    `Meeting · ${new Date().toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    })}`;

  const rows = await query<{ id: string }>(
    `INSERT INTO meetings
       (user_id, meeting_link, platform, title, status, source_language, recorder_type)
     VALUES ($1, $2, $3, $4, 'recording', $5, 'extension')
     RETURNING id`,
    [userId, meetingUrl || null, platform, meetingTitle, sourceLanguage]
  );

  const meetingId = rows[0].id;

  return NextResponse.json({ meetingId });
}
