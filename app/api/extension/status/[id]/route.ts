/**
 * GET /api/extension/status/[id]
 * Polls meeting processing status for the Chrome extension.
 * Also returns bot phase when a Recall.ai bot is associated.
 * Auth: Extension Bearer token.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getExtensionUser } from '@/lib/extension/auth';
import { queryOne } from '@/lib/db';

interface MeetingStatusRow {
  status: string;
  title: string;
  bot_phase: string | null;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await getExtensionUser(req.headers.get('authorization'));
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  const meeting = await queryOne<MeetingStatusRow>(
    `SELECT m.status, m.title, b.status AS bot_phase
     FROM meetings m
     LEFT JOIN bots b ON b.meeting_id = m.id
     WHERE m.id = $1 AND m.user_id = $2
     ORDER BY b.created_at DESC
     LIMIT 1`,
    [id, userId]
  );

  if (!meeting) {
    return NextResponse.json({ error: 'Meeting not found' }, { status: 404 });
  }

  return NextResponse.json({
    status: meeting.status,
    title: meeting.title,
    botPhase: meeting.bot_phase ?? null,
    meetingUrl: `/meetings/${id}`,
  });
}
