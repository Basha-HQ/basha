/**
 * POST /api/bots — create a bot and launch it into a meeting.
 *
 * Request body:
 *   { meetingUrl: string, title?: string }
 *
 * Response:
 *   { botId: string, meetingId: string }
 *
 * The bot runs as a detached child process so this route returns immediately.
 * Poll GET /api/bots/:id for status updates.
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/config';
import { query, queryOne } from '@/lib/db';
import { spawn } from 'child_process';
import path from 'path';

interface CreateBotBody {
  meetingUrl: string;
  title?: string;
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body: CreateBotBody = await req.json();
  const { meetingUrl, title } = body;

  if (!meetingUrl) {
    return NextResponse.json({ error: 'meetingUrl is required' }, { status: 400 });
  }

  // 1. Create a meeting record
  const meeting = await queryOne<{ id: string }>(
    `INSERT INTO meetings (user_id, meeting_link, title, status, platform)
     VALUES ($1, $2, $3, 'recording', 'google_meet')
     RETURNING id`,
    [session.user.id, meetingUrl, title || 'Bot Meeting']
  );
  if (!meeting) {
    return NextResponse.json({ error: 'Failed to create meeting' }, { status: 500 });
  }

  // 2. Create a bot record
  const bot = await queryOne<{ id: string }>(
    `INSERT INTO bots (meeting_id, meeting_url, status)
     VALUES ($1, $2, 'idle')
     RETURNING id`,
    [meeting.id, meetingUrl]
  );
  if (!bot) {
    return NextResponse.json({ error: 'Failed to create bot record' }, { status: 500 });
  }

  // 3. Spawn the bot worker as a detached background process
  const workerPath = path.join(process.cwd(), 'scripts', 'bot-worker.ts');
  const tsconfigPath = path.join(process.cwd(), 'tsconfig.scripts.json');

  const worker = spawn(
    'npx',
    ['ts-node', '--project', tsconfigPath, workerPath, bot.id, meetingUrl, meeting.id, session.user.id],
    {
      cwd: process.cwd(),
      detached: true,
      stdio: 'pipe', // pipe so we can log startup errors
      env: {
        ...process.env,
        // Explicitly pass required env vars to the child process
        DATABASE_URL: process.env.DATABASE_URL ?? '',
        SARVAM_API_KEY: process.env.SARVAM_API_KEY ?? '',
        OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY ?? '',
        UPLOAD_DIR: process.env.UPLOAD_DIR ?? './public/uploads',
      },
    }
  );

  // Log early output from the worker for debugging
  worker.stdout?.on('data', (d) => console.log('[bot-worker]', d.toString().trim()));
  worker.stderr?.on('data', (d) => console.error('[bot-worker]', d.toString().trim()));

  // Detach so Next.js process exiting doesn't kill the bot
  worker.unref();

  console.log(`[api/bots] Spawned bot worker PID=${worker.pid} botId=${bot.id}`);

  return NextResponse.json({ botId: bot.id, meetingId: meeting.id });
}
