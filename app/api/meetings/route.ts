import { NextRequest, NextResponse } from 'next/server';
import { after } from 'next/server';
import { auth } from '@/lib/auth/config';
import { query, queryOne } from '@/lib/db';
import { syncActiveBotsForUser } from '@/lib/bot/syncActiveBots';

export const maxDuration = 300;

// GET /api/meetings — list all meetings for the logged-in user.
//
// Side-effect: kicks off a background sweep of the user's active Recall.ai
// bots via `after()`. The dashboard's client-side poller hits this endpoint
// every 10s, so this sweep gives us a continuous server-side trigger for
// pipeline kickoff that doesn't depend on the user opening a meeting card.
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userId = session.user.id;
  const meetings = await query(
    `SELECT id, title, meeting_link, platform, status, duration, created_at, completed_at, processing_stage
     FROM meetings
     WHERE user_id = $1
     ORDER BY created_at DESC`,
    [userId]
  );

  // Fire-and-forget — never block the response on Recall.ai sync.
  after(() => {
    syncActiveBotsForUser(userId).catch((err) => {
      console.error('[api/meetings] Background bot sweep failed:', err);
    });
  });

  return NextResponse.json({ meetings });
}

// POST /api/meetings — create a new meeting
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { meetingLink, platform, title, sourceLanguage, outputLanguage } = await req.json();

  if (!meetingLink) {
    return NextResponse.json({ error: 'Meeting link is required' }, { status: 400 });
  }

  // Detect platform from link
  const detectedPlatform =
    platform ??
    (meetingLink.includes('meet.google.com')
      ? 'google_meet'
      : meetingLink.includes('zoom.us')
      ? 'zoom'
      : 'other');

  const meeting = await queryOne<{ id: string }>(
    `INSERT INTO meetings (user_id, meeting_link, platform, title, status, source_language, output_language)
     VALUES ($1, $2, $3, $4, 'pending', $5, $6)
     RETURNING id`,
    [
      session.user.id,
      meetingLink,
      detectedPlatform,
      title ?? 'Untitled Meeting',
      sourceLanguage ?? 'auto',
      outputLanguage ?? 'en',
    ]
  );

  return NextResponse.json({ meeting }, { status: 201 });
}
