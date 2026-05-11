/**
 * POST /api/extension/bot
 * Launch a Recall.ai bot from the Chrome extension.
 * Auth: Extension Bearer token.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getExtensionUser } from '@/lib/extension/auth';
import { queryOne } from '@/lib/db';
import { createBot as createRecallBot } from '@/lib/recall/client';

const SUPPORTED_URL_RE =
  /meet\.google\.com\/|zoom\.us\/(j|wc)\/|app\.zoom\.us|teams\.(microsoft|live)\.com|webex\.com\/meet\/|\.webex\.com\/j\//;

export async function POST(req: NextRequest) {
  const userId = await getExtensionUser(req.headers.get('authorization'));
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: { meetingUrl?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const meetingUrl = body.meetingUrl?.trim();
  if (!meetingUrl) {
    return NextResponse.json({ error: 'meetingUrl is required' }, { status: 400 });
  }
  if (!SUPPORTED_URL_RE.test(meetingUrl)) {
    return NextResponse.json(
      { error: 'Unsupported meeting URL. Paste a Google Meet, Zoom, Teams, or Webex link.' },
      { status: 422 }
    );
  }

  let platform = 'other';
  if (meetingUrl.includes('meet.google.com')) platform = 'google_meet';
  else if (meetingUrl.includes('zoom.us')) platform = 'zoom';
  else if (meetingUrl.includes('teams.microsoft.com') || meetingUrl.includes('teams.live.com')) platform = 'teams';
  else if (meetingUrl.includes('webex.com')) platform = 'webex';

  let meetingId: string | null = null;

  try {
    const meeting = await queryOne<{ id: string }>(
      `INSERT INTO meetings (user_id, meeting_link, title, status, platform, recorder_type, source_language, output_language)
       VALUES ($1, $2, 'Bot Meeting', 'recording', $3, 'bot', 'auto', 'en')
       RETURNING id`,
      [userId, meetingUrl, platform]
    );
    if (!meeting) {
      return NextResponse.json({ error: 'Failed to create meeting record' }, { status: 500 });
    }
    meetingId = meeting.id;

    const userPrefs = await queryOne<{ bot_display_name: string | null }>(
      `SELECT bot_display_name FROM users WHERE id = $1`,
      [userId]
    );
    const botName = userPrefs?.bot_display_name?.trim() || 'Basha Notetaker';

    const baseUrl = process.env.NEXTAUTH_URL ?? '';
    const isPublic = baseUrl.startsWith('https://');
    const webhookUrl = isPublic ? `${baseUrl}/api/webhooks/recall` : undefined;
    const recallBot = await createRecallBot(meetingUrl, botName, webhookUrl);

    const bot = await queryOne<{ id: string }>(
      `INSERT INTO bots (meeting_id, meeting_url, recall_bot_id, status)
       VALUES ($1, $2, $3, 'joining')
       RETURNING id`,
      [meetingId, meetingUrl, recallBot.id]
    );
    if (!bot) {
      return NextResponse.json({ error: 'Failed to create bot record' }, { status: 500 });
    }

    return NextResponse.json({ botId: bot.id, meetingId });
  } catch (err) {
    console.error('[api/extension/bot] Error:', err);
    if (meetingId) {
      await queryOne('DELETE FROM meetings WHERE id = $1', [meetingId]).catch(() => {});
    }
    return NextResponse.json({ error: 'Failed to launch bot' }, { status: 500 });
  }
}
