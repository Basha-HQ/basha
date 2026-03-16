/**
 * GET /api/extension/status/[id]
 * Polls meeting processing status for the Chrome extension.
 * Auth: Extension Bearer token.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getExtensionUser } from '@/lib/extension/auth';
import { queryOne } from '@/lib/db';

interface MeetingStatusRow {
  status: string;
  title: string;
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
    `SELECT status, title FROM meetings WHERE id = $1 AND user_id = $2`,
    [id, userId]
  );

  if (!meeting) {
    return NextResponse.json({ error: 'Meeting not found' }, { status: 404 });
  }

  return NextResponse.json({
    status: meeting.status,
    title: meeting.title,
    meetingUrl: `/meetings/${id}`,
  });
}
