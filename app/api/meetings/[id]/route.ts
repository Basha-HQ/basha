import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/config';
import { queryOne } from '@/lib/db';

// GET /api/meetings/[id] — get single meeting details
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  const meeting = await queryOne(
    `SELECT id, title, meeting_link, platform, status, duration, summary, created_at, completed_at
     FROM meetings
     WHERE id = $1 AND user_id = $2`,
    [id, session.user.id]
  );

  if (!meeting) {
    return NextResponse.json({ error: 'Meeting not found' }, { status: 404 });
  }

  return NextResponse.json({ meeting });
}

// PATCH /api/meetings/[id] — update meeting (title, status)
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const { title, status } = await req.json();

  const meeting = await queryOne(
    `UPDATE meetings SET title = COALESCE($1, title), status = COALESCE($2, status)
     WHERE id = $3 AND user_id = $4
     RETURNING id, title, status`,
    [title, status, id, session.user.id]
  );

  if (!meeting) {
    return NextResponse.json({ error: 'Meeting not found' }, { status: 404 });
  }

  return NextResponse.json({ meeting });
}
