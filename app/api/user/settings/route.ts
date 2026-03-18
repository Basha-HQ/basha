import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/config';
import { queryOne } from '@/lib/db';

interface UserSettings {
  auto_join_all: boolean;
  preferred_languages: string[];
  output_language: string;
  output_script: string;
  meeting_platform: string;
}

// GET /api/user/settings — fetch current user settings
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const settings = await queryOne<UserSettings>(
    'SELECT auto_join_all, preferred_languages, output_language, output_script, meeting_platform FROM users WHERE id = $1',
    [session.user.id]
  );

  return NextResponse.json(settings ?? { auto_join_all: false, preferred_languages: [], output_language: 'en', output_script: 'roman', meeting_platform: 'both' });
}

// PATCH /api/user/settings — update one or more user settings
export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json();
  const allowedFields = ['auto_join_all', 'preferred_languages', 'output_language', 'output_script', 'meeting_platform'] as const;

  const updates: string[] = [];
  const values: unknown[] = [];

  for (const field of allowedFields) {
    if (field in body) {
      updates.push(`${field} = $${values.length + 1}`);
      values.push(body[field]);
    }
  }

  if (updates.length === 0) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
  }

  values.push(session.user.id);
  const settings = await queryOne<UserSettings>(
    `UPDATE users SET ${updates.join(', ')} WHERE id = $${values.length}
     RETURNING auto_join_all, preferred_languages, output_language, output_script, meeting_platform`,
    values
  );

  return NextResponse.json(settings);
}
