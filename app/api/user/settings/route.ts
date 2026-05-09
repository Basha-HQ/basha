import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/config';
import { queryOne } from '@/lib/db';

interface UserSettings {
  auto_join_all: boolean;
  auto_join_mode: string;
  bot_display_name: string;
  preferred_languages: string[];
  output_language: string;
  output_script: string;
  meeting_platform: string;
  speaking_language: string;
  google_calendar_connected: boolean;
}

const SELECT_FIELDS =
  'auto_join_all, auto_join_mode, bot_display_name, preferred_languages, output_language, output_script, meeting_platform, speaking_language, google_calendar_connected';

// GET /api/user/settings — fetch current user settings
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const settings = await queryOne<UserSettings>(
    `SELECT ${SELECT_FIELDS} FROM users WHERE id = $1`,
    [session.user.id]
  );

  return NextResponse.json(
    settings ?? {
      auto_join_all: false,
      auto_join_mode: 'off',
      bot_display_name: 'Basha Notetaker',
      preferred_languages: [],
      output_language: 'en',
      output_script: 'roman',
      meeting_platform: 'both',
      speaking_language: 'auto',
      google_calendar_connected: false,
    }
  );
}

// PATCH /api/user/settings — update one or more user settings
export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json();
  // Validate auto_join_mode value when present — DB has CHECK constraint but
  // we want a clean 400 instead of a Postgres error.
  if ('auto_join_mode' in body && !['off', 'all', 'organizer_only'].includes(body.auto_join_mode)) {
    return NextResponse.json({ error: 'auto_join_mode must be off | all | organizer_only' }, { status: 400 });
  }
  if ('bot_display_name' in body) {
    const name = String(body.bot_display_name ?? '').trim();
    if (!name || name.length > 80) {
      return NextResponse.json({ error: 'bot_display_name must be 1–80 characters' }, { status: 400 });
    }
    body.bot_display_name = name;
  }

  const allowedFields = [
    'auto_join_all',
    'auto_join_mode',
    'bot_display_name',
    'preferred_languages',
    'output_language',
    'output_script',
    'meeting_platform',
    'speaking_language',
  ] as const;

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
     RETURNING ${SELECT_FIELDS}`,
    values
  );

  return NextResponse.json(settings);
}
