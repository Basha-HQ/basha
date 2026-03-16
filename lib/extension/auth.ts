/**
 * Extension token authentication helper.
 * Validates the Bearer token sent by the Chrome extension in the Authorization header.
 * Returns the userId if valid, null otherwise.
 */

import { createHash } from 'crypto';
import { queryOne } from '@/lib/db';

interface ExtensionTokenRow {
  user_id: string;
}

export async function getExtensionUser(authHeader: string | null): Promise<string | null> {
  if (!authHeader?.startsWith('Bearer ')) return null;

  const rawToken = authHeader.slice(7).trim();
  if (!rawToken) return null;

  const tokenHash = createHash('sha256').update(rawToken).digest('hex');

  const row = await queryOne<ExtensionTokenRow>(
    `SELECT user_id FROM extension_tokens
     WHERE token_hash = $1 AND expires_at > NOW()`,
    [tokenHash]
  );

  if (!row) return null;

  // Update last_used_at asynchronously (don't await — don't block the request)
  queryOne(
    `UPDATE extension_tokens SET last_used_at = NOW() WHERE token_hash = $1 RETURNING id`,
    [tokenHash]
  ).catch(() => {});

  return row.user_id;
}
