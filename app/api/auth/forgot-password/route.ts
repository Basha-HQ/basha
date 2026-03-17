/**
 * POST /api/auth/forgot-password
 * Generates a single-use password reset token, stores it hashed, and emails the link.
 * Always returns 200 to avoid revealing whether an email exists.
 */

import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { createHash } from 'crypto';
import { query, queryOne } from '@/lib/db';
import { sendPasswordResetEmail } from '@/lib/email';

export async function POST(req: NextRequest) {
  let email: string;
  try {
    const body = await req.json();
    email = (body.email ?? '').trim().toLowerCase();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  if (!email) {
    return NextResponse.json({ error: 'Email is required' }, { status: 400 });
  }

  // Always return 200 — don't reveal if email exists
  const user = await queryOne<{ id: string; email: string }>(
    `SELECT id, email FROM users WHERE email = $1 AND password_hash IS NOT NULL`,
    [email]
  );

  if (user) {
    const rawToken = randomUUID();
    const tokenHash = createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    // Invalidate any previous unused tokens for this user
    await query(
      `UPDATE password_reset_tokens SET used = true WHERE user_id = $1 AND used = false`,
      [user.id]
    );

    await query(
      `INSERT INTO password_reset_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3)`,
      [user.id, tokenHash, expiresAt.toISOString()]
    );

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? '';
    const resetUrl = `${appUrl}/reset-password?token=${rawToken}`;

    sendPasswordResetEmail(user.email, resetUrl).catch((err) =>
      console.error('[forgot-password] Failed to send email:', err)
    );
  }

  return NextResponse.json({ ok: true });
}
