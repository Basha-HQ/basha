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

// PATCH /api/meetings/[id] — update meeting (title, status, speaker_labels)
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const { title, status, speaker_labels } = await req.json();

  // Validate speaker_labels if provided — must be a flat object of string → string
  if (speaker_labels !== undefined) {
    if (typeof speaker_labels !== 'object' || Array.isArray(speaker_labels)) {
      return NextResponse.json({ error: 'speaker_labels must be an object' }, { status: 400 });
    }
    for (const [k, v] of Object.entries(speaker_labels)) {
      if (typeof k !== 'string' || typeof v !== 'string') {
        return NextResponse.json({ error: 'speaker_labels keys and values must be strings' }, { status: 400 });
      }
      if (k.length > 50 || (v as string).length > 200) {
        return NextResponse.json({ error: 'speaker_labels key or value too long' }, { status: 400 });
      }
    }
  }

  const meeting = await queryOne(
    `UPDATE meetings
     SET title = COALESCE($1, title),
         status = COALESCE($2, status),
         speaker_labels = COALESCE($3::jsonb, speaker_labels)
     WHERE id = $4 AND user_id = $5
     RETURNING id, title, status, speaker_labels`,
    [title ?? null, status ?? null, speaker_labels !== undefined ? JSON.stringify(speaker_labels) : null, id, session.user.id]
  );

  if (!meeting) {
    return NextResponse.json({ error: 'Meeting not found' }, { status: 404 });
  }

  return NextResponse.json({ meeting });
}
