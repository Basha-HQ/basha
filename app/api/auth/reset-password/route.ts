/**
 * POST /api/auth/reset-password
 * Validates the reset token and updates the user's password.
 * Body: { token: string, password: string }
 */

import { NextRequest, NextResponse } from 'next/server';
import { createHash } from 'crypto';
import bcrypt from 'bcryptjs';
import { query, queryOne } from '@/lib/db';

export async function POST(req: NextRequest) {
  let token: string, password: string;
  try {
    const body = await req.json();
    token = (body.token ?? '').trim();
    password = body.password ?? '';
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  if (!token) {
    return NextResponse.json({ error: 'Token is required' }, { status: 400 });
  }
  if (!password || password.length < 8) {
    return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 });
  }

  const tokenHash = createHash('sha256').update(token).digest('hex');

  const record = await queryOne<{ id: string; user_id: string; expires_at: string; used: boolean }>(
    `SELECT id, user_id, expires_at, used FROM password_reset_tokens WHERE token_hash = $1`,
    [tokenHash]
  );

  if (!record) {
    return NextResponse.json({ error: 'Invalid or expired reset link' }, { status: 400 });
  }
  if (record.used) {
    return NextResponse.json({ error: 'This reset link has already been used' }, { status: 400 });
  }
  if (new Date(record.expires_at) < new Date()) {
    return NextResponse.json({ error: 'Reset link has expired — please request a new one' }, { status: 400 });
  }

  const passwordHash = await bcrypt.hash(password, 12);

  await query(`UPDATE users SET password_hash = $1 WHERE id = $2`, [passwordHash, record.user_id]);
  await query(`UPDATE password_reset_tokens SET used = true WHERE id = $1`, [record.id]);

  return NextResponse.json({ ok: true });
}
