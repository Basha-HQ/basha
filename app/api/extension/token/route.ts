/**
 * GET /api/extension/token
 * Generates a long-lived extension auth token for the Chrome extension.
 * Requires a valid NextAuth session.
 * Returns the raw token once — it is never stored in plaintext.
 */

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth/config';
import { query, queryOne } from '@/lib/db';
import { randomBytes, createHash } from 'crypto';

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userId = session.user.id;

  // Revoke any existing token for this user before issuing a new one
  await query(`DELETE FROM extension_tokens WHERE user_id = $1`, [userId]);

  // Generate a cryptographically random 32-byte token
  const rawToken = randomBytes(32).toString('hex');
  const tokenHash = createHash('sha256').update(rawToken).digest('hex');

  // Token expires in 90 days
  const expiresAt = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);

  await query(
    `INSERT INTO extension_tokens (user_id, token_hash, expires_at)
     VALUES ($1, $2, $3)`,
    [userId, tokenHash, expiresAt.toISOString()]
  );

  return NextResponse.json({
    token: rawToken,
    expiresAt: expiresAt.toISOString(),
  });
}

export async function DELETE() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  await query(`DELETE FROM extension_tokens WHERE user_id = $1`, [session.user.id]);

  return NextResponse.json({ success: true });
}

// Used by settings page to check if a token exists (without revealing it)
export async function HEAD() {
  const session = await auth();
  if (!session?.user?.id) {
    return new Response(null, { status: 401 });
  }

  const row = await queryOne(
    `SELECT id, created_at, expires_at, last_used_at FROM extension_tokens WHERE user_id = $1`,
    [session.user.id]
  );

  if (!row) return new Response(null, { status: 404 });
  return new Response(null, { status: 200 });
}

// Used by settings page to show token metadata (no raw token returned)
export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const row = await queryOne<{ created_at: string; expires_at: string; last_used_at: string | null }>(
    `SELECT created_at, expires_at, last_used_at FROM extension_tokens WHERE user_id = $1`,
    [session.user.id]
  );

  if (!row) return NextResponse.json({ exists: false });

  return NextResponse.json({
    exists: true,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
    lastUsedAt: row.last_used_at,
  });
}
