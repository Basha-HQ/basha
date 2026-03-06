/**
 * GET  /api/bots/:id  — poll bot status
 * DELETE /api/bots/:id  — remove bot from meeting (kill process)
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/config';
import { queryOne, query } from '@/lib/db';

interface BotRow {
  id: string;
  meeting_id: string;
  meeting_url: string;
  status: string;
  error: string | null;
  pid: number | null;
  created_at: string;
  updated_at: string;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  // Join to verify the bot belongs to the current user's meeting
  const bot = await queryOne<BotRow>(
    `SELECT b.id, b.meeting_id, b.meeting_url, b.status, b.error, b.pid, b.created_at, b.updated_at
     FROM bots b
     JOIN meetings m ON m.id = b.meeting_id
     WHERE b.id = $1 AND m.user_id = $2`,
    [id, session.user.id]
  );

  if (!bot) {
    return NextResponse.json({ error: 'Bot not found' }, { status: 404 });
  }

  return NextResponse.json({ bot });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  const bot = await queryOne<BotRow>(
    `SELECT b.id, b.pid, b.status
     FROM bots b
     JOIN meetings m ON m.id = b.meeting_id
     WHERE b.id = $1 AND m.user_id = $2`,
    [id, session.user.id]
  );

  if (!bot) {
    return NextResponse.json({ error: 'Bot not found' }, { status: 404 });
  }

  // Kill the worker process if it's running
  if (bot.pid) {
    try {
      process.kill(bot.pid, 'SIGTERM');
    } catch {
      // Process may have already exited — that's fine
    }
  }

  await query(
    `UPDATE bots SET status = 'failed', error = 'Stopped by user', updated_at = NOW() WHERE id = $1`,
    [id]
  );

  return NextResponse.json({ success: true });
}
