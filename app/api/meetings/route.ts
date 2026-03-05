import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/config';
import { query, queryOne } from '@/lib/db';

// GET /api/meetings — list all meetings for the logged-in user
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const meetings = await query(
    `SELECT id, title, meeting_link, platform, status, duration, created_at, completed_at
     FROM meetings
     WHERE user_id = $1
     ORDER BY created_at DESC`,
    [session.user.id]
  );

  return NextResponse.json({ meetings });
}

// POST /api/meetings — create a new meeting
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { meetingLink, platform, title } = await req.json();

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
    `INSERT INTO meetings (user_id, meeting_link, platform, title, status)
     VALUES ($1, $2, $3, $4, 'pending')
     RETURNING id`,
    [session.user.id, meetingLink, detectedPlatform, title ?? 'Untitled Meeting']
  );

  return NextResponse.json({ meeting }, { status: 201 });
}
