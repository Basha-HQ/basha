import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/config';
import { queryOne } from '@/lib/db';

// POST /api/meetings/[id]/share — generate share token (idempotent)
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  // Generate token if not already set, return existing if already set
  const row = await queryOne<{ share_token: string }>(
    `UPDATE meetings
     SET share_token = COALESCE(share_token, gen_random_uuid())
     WHERE id = $1 AND user_id = $2
     RETURNING share_token`,
    [id, session.user.id]
  );

  if (!row) {
    return NextResponse.json({ error: 'Meeting not found' }, { status: 404 });
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? '';
  return NextResponse.json({
    shareToken: row.share_token,
    shareUrl: `${appUrl}/share/${row.share_token}`,
  });
}

// DELETE /api/meetings/[id]/share — revoke share token
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  const row = await queryOne(
    `UPDATE meetings SET share_token = NULL
     WHERE id = $1 AND user_id = $2
     RETURNING id`,
    [id, session.user.id]
  );

  if (!row) {
    return NextResponse.json({ error: 'Meeting not found' }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}
