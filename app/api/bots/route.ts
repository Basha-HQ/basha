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
  sourceLanguage?: string;
  outputLanguage?: string;
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: CreateBotBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const { meetingUrl, title, sourceLanguage, outputLanguage } = body;

  if (!meetingUrl) {
    return NextResponse.json({ error: 'meetingUrl is required' }, { status: 400 });
  }

  // Detect platform from URL
  let platform = 'other';
  if (meetingUrl.includes('meet.google.com')) platform = 'google_meet';
  else if (meetingUrl.includes('zoom.us')) platform = 'zoom';

  let meetingId: string | null = null;

  try {
    // 1. Create meeting record
    const meeting = await queryOne<{ id: string }>(
      `INSERT INTO meetings (user_id, meeting_link, title, status, platform, source_language, output_language)
       VALUES ($1, $2, $3, 'recording', $4, $5, $6)
       RETURNING id`,
      [session.user.id, meetingUrl, title || 'Bot Meeting', platform, sourceLanguage ?? 'auto', outputLanguage ?? 'en']
    );
    if (!meeting) {
      return NextResponse.json({ error: 'Failed to create meeting record' }, { status: 500 });
    }
    meetingId = meeting.id;

    // 2. Call Recall.ai to create a bot that joins the meeting
    const recallBot = await createRecallBot(meetingUrl, 'LinguaMeet Bot');

    // 3. Store bot record with Recall.ai bot ID
    const bot = await queryOne<{ id: string }>(
      `INSERT INTO bots (meeting_id, meeting_url, recall_bot_id, status)
       VALUES ($1, $2, $3, 'joining')
       RETURNING id`,
      [meetingId, meetingUrl, recallBot.id]
    );
    if (!bot) {
      return NextResponse.json({ error: 'Failed to create bot record' }, { status: 500 });
    }

    console.log(`[api/bots] Created Recall.ai bot ${recallBot.id} → local bot ${bot.id}`);

    return NextResponse.json({ botId: bot.id, meetingId });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[api/bots] Error:', message);

    // Clean up the meeting record if something failed after creating it
    if (meetingId) {
      await query('DELETE FROM meetings WHERE id = $1', [meetingId]).catch(() => {});
    }

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
