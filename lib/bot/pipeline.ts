/**
 * Shared bot processing pipeline.
 * Called when Recall.ai finishes recording — downloads audio, runs Sarvam STT,
 * translates, summarizes, and updates the DB.
 *
 * Imported by:
 *   - app/api/bots/[id]/route.ts  (polling path)
 *   - app/api/webhooks/recall/route.ts  (webhook path)
 */

import { query, queryOne } from '@/lib/db';
import { getRecordingUrl, type RecallBot } from '@/lib/recall/client';
import { transcribeAudio, translateToEnglish, splitIntoSegments } from '@/lib/ai/sarvam';
import { generateSummary, generateMeetingTitle } from '@/lib/ai/summarize';
import path from 'path';
import fs from 'fs';

export interface BotRow {
  id: string;
  meeting_id: string;
  meeting_url: string;
  recall_bot_id: string | null;
  status: string;
  error: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Called when Recall.ai status becomes "done" — recording is ready.
 * Downloads audio, runs Sarvam STT → translate → summarize, updates DB.
 */
export async function handleRecordingReady(
  bot: BotRow,
  recallBot: RecallBot,
  userId: string
): Promise<void> {
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
      [`/uploads/${userId}/${bot.meeting_id}.${ext}`, bot.meeting_id]
    );

    // 4. Transcribe with Sarvam AI
    const meeting = await queryOne<{ title: string }>(
      'SELECT title FROM meetings WHERE id = $1',
      [bot.meeting_id]
    );
    const fileName = path.basename(audioPath);
    const sttResult = await transcribeAudio(audioBuffer, fileName);

    // Log first diarized entry so we can verify Sarvam's actual field names
    if (sttResult.diarized_entries?.length) {
      console.log('[pipeline] Sarvam diarized entry[0]:', JSON.stringify(sttResult.diarized_entries[0]));
    } else {
      console.log('[pipeline] No diarized_entries returned by Sarvam — using fallback');
    }

    // Use diarized segments (real timestamps + speaker) if available; fall back to sentence splitting
    const segments: Array<{ text: string; startSeconds: number; speaker: string | null }> =
      sttResult.diarized_entries?.length
        ? sttResult.diarized_entries.map((e) => {
            // Guard against undefined/NaN — Sarvam may use different field names
            const raw = e as unknown as Record<string, unknown>;
            const startRaw = e.start ?? raw['start_time'] ?? raw['start_ms'];
            const startSec =
              typeof startRaw === 'number' && Number.isFinite(startRaw)
                ? // Detect milliseconds: if value > 3600 and duration is short, assume ms
                  startRaw > 3600 ? Math.round(startRaw / 1000) : Math.round(startRaw)
                : 0;
            return {
              text: e.transcript,
              startSeconds: startSec,
              speaker: e.speaker ?? null,
            };
          })
        : splitIntoSegments(sttResult.transcript, 0).map((s) => ({ ...s, speaker: null }));

    // 5. Translate each segment
    const englishSegments: string[] = [];
    for (let i = 0; i < segments.length; i++) {
      const seg = segments[i];
      const en = await translateToEnglish(seg.text, sttResult.language_code ?? 'auto');
      englishSegments.push(en);

      await query(
        `INSERT INTO transcripts (meeting_id, segment_index, timestamp_seconds, original_text, english_text, speaker)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [bot.meeting_id, i, seg.startSeconds, seg.text, en, seg.speaker]
      );
    }

    // 6. Generate summary
    const fullEnglish = englishSegments.join(' ');
    const summary = await generateSummary(fullEnglish, meeting?.title);

    // 6b. Generate AI title from summary topics (best-effort; falls back silently)
    const aiTitle = await generateMeetingTitle(summary);

    // 7. Mark completed — update title only if AI produced one
    await query(
      `UPDATE meetings
       SET status = 'completed', summary = $1, completed_at = NOW()${aiTitle ? ', title = $3' : ''}
       WHERE id = $2`,
      aiTitle
        ? [JSON.stringify(summary), bot.meeting_id, aiTitle]
        : [JSON.stringify(summary), bot.meeting_id]
    );
    await query(
      `UPDATE bots SET status = 'completed', updated_at = NOW() WHERE id = $1`,
      [bot.id]
    );

    console.log(`[pipeline] Processing complete for meeting ${bot.meeting_id}`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[pipeline] Processing error:', msg);
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
