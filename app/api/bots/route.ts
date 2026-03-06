/**
 * POST /api/bots — create a Recall.ai bot and send it into a meeting.
 *
 * Request body:
 *   { meetingUrl: string, title?: string }
 *
 * Response:
 *   { botId: string, meetingId: string }
 *
 * The Recall.ai bot runs on their infrastructure — no local process needed.
 * Poll GET /api/bots/:id for status updates (proxies to Recall.ai).
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/config';
import { query, queryOne } from '@/lib/db';
import { createBot as createRecallBot } from '@/lib/recall/client';

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

  // Detect platform from URL
  let platform = 'other';
  if (meetingUrl.includes('meet.google.com')) platform = 'google_meet';
  else if (meetingUrl.includes('zoom.us')) platform = 'zoom';

  // 1. Create meeting record
  const meeting = await queryOne<{ id: string }>(
    `INSERT INTO meetings (user_id, meeting_link, title, status, platform)
     VALUES ($1, $2, $3, 'recording', $4)
     RETURNING id`,
    [session.user.id, meetingUrl, title || 'Bot Meeting', platform]
  );
  if (!meeting) {
    return NextResponse.json({ error: 'Failed to create meeting' }, { status: 500 });
  }

  try {
    // 2. Call Recall.ai to create a bot that joins the meeting
    const recallBot = await createRecallBot(meetingUrl, 'LinguaMeet Bot');

    // 3. Store bot record with Recall.ai bot ID
    const bot = await queryOne<{ id: string }>(
      `INSERT INTO bots (meeting_id, meeting_url, recall_bot_id, status)
       VALUES ($1, $2, $3, 'joining')
       RETURNING id`,
      [meeting.id, meetingUrl, recallBot.id]
    );
    if (!bot) {
      return NextResponse.json({ error: 'Failed to create bot record' }, { status: 500 });
    }

    console.log(`[api/bots] Created Recall.ai bot ${recallBot.id} → local bot ${bot.id}`);

    return NextResponse.json({ botId: bot.id, meetingId: meeting.id });
  } catch (err) {
    // Clean up the meeting record if Recall.ai call fails
    await query('DELETE FROM meetings WHERE id = $1', [meeting.id]);
    console.error('[api/bots] Recall.ai error:', err);
    return NextResponse.json(
      { error: `Failed to create bot: ${err instanceof Error ? err.message : String(err)}` },
      { status: 502 }
    );
  }
}
