import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/config';
import { query, queryOne } from '@/lib/db';

// POST /api/transcripts/[id]/flag — flag a transcript segment with optional correction
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const { flaggedText, comment, suggestedCorrection } = await req.json();

  // Verify transcript exists
  const transcript = await queryOne(
    'SELECT id FROM transcripts WHERE id = $1',
    [id]
  );

  if (!transcript) {
    return NextResponse.json({ error: 'Transcript segment not found' }, { status: 404 });
  }

  // Prevent duplicate flags from the same user on the same segment
  const existing = await queryOne(
    'SELECT id FROM flags WHERE transcript_id = $1 AND user_id = $2',
    [id, session.user.id]
  );

  if (existing) {
    return NextResponse.json({ error: 'Already flagged' }, { status: 409 });
  }

  await query(
    `INSERT INTO flags (transcript_id, user_id, flagged_text, user_comment, suggested_correction)
     VALUES ($1, $2, $3, $4, $5)`,
    [
      id,
      session.user.id,
      flaggedText ?? null,
      comment ?? null,
      suggestedCorrection?.trim() || null,
    ]
  );

  return NextResponse.json({ success: true }, { status: 201 });
}
