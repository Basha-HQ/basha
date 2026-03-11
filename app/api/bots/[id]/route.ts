/**
 * GET    /api/bots/:id  — poll bot status (syncs with Recall.ai)
 * DELETE /api/bots/:id  — remove bot from meeting
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/config';
import { queryOne, query } from '@/lib/db';
import {
  getBot as getRecallBot,
  deleteBot as deleteRecallBot,
  getLatestStatus,
  mapRecallStatus,
  getRecordingUrl,
} from '@/lib/recall/client';
import { transcribeAudio, translateToEnglish, splitIntoSegments } from '@/lib/ai/sarvam';
import { generateSummary } from '@/lib/ai/summarize';
import path from 'path';
import fs from 'fs';

interface BotRow {
  id: string;
  meeting_id: string;
  meeting_url: string;
  recall_bot_id: string | null;
  status: string;
  error: string | null;
  created_at: string;
  updated_at: string;
}

// ── GET — poll status ─────────────────────────────────────────────────────────

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  const bot = await queryOne<BotRow>(
    `SELECT b.id, b.meeting_id, b.meeting_url, b.recall_bot_id, b.status, b.error, b.created_at, b.updated_at
     FROM bots b
     JOIN meetings m ON m.id = b.meeting_id
     WHERE b.id = $1 AND m.user_id = $2`,
    [id, session.user.id]
  );

  if (!bot) {
    return NextResponse.json({ error: 'Bot not found' }, { status: 404 });
  }

  // If bot is still active, sync status from Recall.ai
  if (bot.recall_bot_id && !['completed', 'failed'].includes(bot.status)) {
    try {
      const recallBot = await getRecallBot(bot.recall_bot_id);
      const recallStatus = getLatestStatus(recallBot);
      const mappedStatus = mapRecallStatus(recallStatus);

      if (mappedStatus === 'done') {
        // Recording is ready — download audio and start processing
        await handleRecordingReady(bot, recallBot, session.user.id);
        // Re-fetch updated bot from DB
        const updated = await queryOne<BotRow>(
          'SELECT * FROM bots WHERE id = $1',
          [id]
        );
        if (updated) {
          return NextResponse.json({ bot: updated });
        }
      } else if (mappedStatus === 'failed') {
        const errorMsg = recallBot.status_changes?.at(-1)?.message ?? 'Bot failed';
        await query(
          `UPDATE bots SET status = 'failed', error = $1, updated_at = NOW() WHERE id = $2`,
          [errorMsg, bot.id]
        );
        bot.status = 'failed';
        bot.error = errorMsg;
      } else if (mappedStatus !== bot.status) {
        // Status changed — update DB
        await query(
          `UPDATE bots SET status = $1, updated_at = NOW() WHERE id = $2`,
          [mappedStatus, bot.id]
        );
        bot.status = mappedStatus;
      }
    } catch (err) {
      // Recall.ai API error — return cached DB status, don't crash
      console.error('[api/bots] Recall.ai sync error:', err);
    }
  }

  return NextResponse.json({ bot });
}

// ── DELETE — stop bot ─────────────────────────────────────────────────────────

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  const bot = await queryOne<BotRow>(
    `SELECT b.id, b.recall_bot_id, b.status
     FROM bots b
     JOIN meetings m ON m.id = b.meeting_id
     WHERE b.id = $1 AND m.user_id = $2`,
    [id, session.user.id]
  );

  if (!bot) {
    return NextResponse.json({ error: 'Bot not found' }, { status: 404 });
  }

  // Tell Recall.ai to remove the bot from the meeting
  if (bot.recall_bot_id) {
    try {
      await deleteRecallBot(bot.recall_bot_id);
    } catch {
      // Bot may have already left — that's fine
    }
  }

  await query(
    `UPDATE bots SET status = 'failed', error = 'Stopped by user', updated_at = NOW() WHERE id = $1`,
    [id]
  );

  // Also update the meeting status so it doesn't stay stuck on 'recording'
  await query(
    `UPDATE meetings SET status = 'failed' WHERE id = (SELECT meeting_id FROM bots WHERE id = $1)`,
    [id]
  );

  return NextResponse.json({ success: true });
}

// ── Processing pipeline ───────────────────────────────────────────────────────

/**
 * Called when Recall.ai status becomes "done" — recording is ready.
 * Downloads audio, runs Sarvam STT → translate → summarize, updates DB.
 */
async function handleRecordingReady(
  bot: BotRow,
  recallBot: import('@/lib/recall/client').RecallBot,
  userId: string
) {
  await query(
    `UPDATE bots SET status = 'processing', updated_at = NOW() WHERE id = $1`,
    [bot.id]
  );
  await query(
    `UPDATE meetings SET status = 'processing' WHERE id = $1`,
    [bot.meeting_id]
  );

  try {
    // 1. Get recording download URL
    const downloadUrl = getRecordingUrl(recallBot);
    if (!downloadUrl) throw new Error('No recording URL available from Recall.ai');

    // 2. Download the audio file
    const audioRes = await fetch(downloadUrl);
    if (!audioRes.ok) throw new Error(`Failed to download recording: ${audioRes.status}`);
    const audioArrayBuffer = await audioRes.arrayBuffer();
    const audioBuffer = Buffer.from(audioArrayBuffer);

    // 3. Save audio locally
    const uploadDir = process.env.UPLOAD_DIR ?? './public/uploads';
    const dir = path.join(process.cwd(), uploadDir, userId);
    fs.mkdirSync(dir, { recursive: true });
    const ext = downloadUrl.includes('.mp4') ? 'mp4' : 'webm';
    const audioPath = path.join(dir, `${bot.meeting_id}.${ext}`);
    fs.writeFileSync(audioPath, audioBuffer);

    await query(
      `UPDATE meetings SET audio_path = $1 WHERE id = $2`,
      [`uploads/${userId}/${bot.meeting_id}.${ext}`, bot.meeting_id]
    );

    // 4. Transcribe with Sarvam AI
    const meeting = await queryOne<{ title: string }>(
      'SELECT title FROM meetings WHERE id = $1',
      [bot.meeting_id]
    );
    const fileName = path.basename(audioPath);
    const sttResult = await transcribeAudio(audioBuffer, fileName);

    const segments = splitIntoSegments(sttResult.transcript, 0);

    // 5. Translate each segment
    const englishSegments: string[] = [];
    for (let i = 0; i < segments.length; i++) {
      const seg = segments[i];
      const en = await translateToEnglish(seg.text, sttResult.language_code ?? 'auto');
      englishSegments.push(en);

      await query(
        `INSERT INTO transcripts (meeting_id, segment_index, timestamp_seconds, original_text, english_text)
         VALUES ($1, $2, $3, $4, $5)`,
        [bot.meeting_id, i, seg.startSeconds, seg.text, en]
      );
    }

    // 6. Generate summary
    const fullEnglish = englishSegments.join(' ');
    const summary = await generateSummary(fullEnglish, meeting?.title);

    // 7. Mark completed
    await query(
      `UPDATE meetings SET status = 'completed', summary = $1, completed_at = NOW() WHERE id = $2`,
      [JSON.stringify(summary), bot.meeting_id]
    );
    await query(
      `UPDATE bots SET status = 'completed', updated_at = NOW() WHERE id = $1`,
      [bot.id]
    );

    console.log(`[api/bots] Processing complete for meeting ${bot.meeting_id}`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[api/bots] Processing error:', msg);
    await query(
      `UPDATE bots SET status = 'failed', error = $1, updated_at = NOW() WHERE id = $2`,
      [msg, bot.id]
    );
    await query(
      `UPDATE meetings SET status = 'failed' WHERE id = $1`,
      [bot.meeting_id]
    );
  }
}
