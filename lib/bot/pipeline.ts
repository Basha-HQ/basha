/**
 * Bot processing pipeline (Recall.ai path).
 * Downloads audio from Recall.ai, then delegates to the shared recording pipeline.
 *
 * Imported by:
 *   - app/api/bots/[id]/route.ts        (polling path)
 *   - app/api/webhooks/recall/route.ts  (webhook path)
 */

import { query, queryOne } from '@/lib/db';
import { getRecordingUrl, type RecallBot } from '@/lib/recall/client';
import { processAudioForMeeting } from '@/lib/recording/pipeline';
import { sendBotFailureEmail } from '@/lib/email';

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
 * Downloads audio from Recall.ai, then runs the shared AI pipeline.
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

  try {
    // 1. Get recording download URL from Recall.ai
    const downloadUrl = getRecordingUrl(recallBot);
    if (!downloadUrl) throw new Error('No recording URL available from Recall.ai');

    // 2. Download the audio file
    const audioRes = await fetch(downloadUrl);
    if (!audioRes.ok) throw new Error(`Failed to download recording: ${audioRes.status}`);
    const audioBuffer = Buffer.from(await audioRes.arrayBuffer());

    // 3. Persist audio buffer in DB (BYTEA) — Recall.ai presigned URLs expire ~7 days,
    //    storing the buffer directly gives permanent playback from our own endpoint.
    const ext = downloadUrl.includes('.mp4') ? 'mp4' : 'webm';
    await query(
      `UPDATE meetings SET audio_data = $1, audio_path = $2 WHERE id = $3`,
      [audioBuffer, `/api/meetings/${bot.meeting_id}/audio`, bot.meeting_id]
    );

    // 4. Fetch source_language for the meeting + user's output_script preference
    const [meeting, userPrefs] = await Promise.all([
      queryOne<{ source_language: string }>(
        'SELECT source_language FROM meetings WHERE id = $1',
        [bot.meeting_id]
      ),
      queryOne<{ output_script: string }>(
        'SELECT output_script FROM users WHERE id = $1',
        [userId]
      ),
    ]);

    // 5. Delegate to shared pipeline
    await processAudioForMeeting({
      meetingId: bot.meeting_id,
      audioBuffer,
      fileName: `${bot.meeting_id}.${ext}`,
      sourceLanguage: meeting?.source_language ?? 'auto',
      outputScript: (userPrefs?.output_script ?? 'roman') as 'roman' | 'fully-native' | 'spoken-form-in-native',
    });

    await query(
      `UPDATE bots SET status = 'completed', updated_at = NOW() WHERE id = $1`,
      [bot.id]
    );

    console.log(`[bot-pipeline] Processing complete for meeting ${bot.meeting_id}`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[bot-pipeline] Processing error:', msg);
    await query(
      `UPDATE bots SET status = 'failed', error = $1, updated_at = NOW() WHERE id = $2`,
      [msg, bot.id]
    );
    // meetings.status is already set to 'failed' by the shared pipeline on throw

    // Notify the user by email
    const userRow = await queryOne<{ email: string; name: string; title: string }>(
      `SELECT u.email, u.name, m.title FROM users u JOIN meetings m ON m.user_id = u.id WHERE m.id = $1`,
      [bot.meeting_id]
    ).catch(() => null);
    if (userRow) {
      sendBotFailureEmail(userRow.email, userRow.name, userRow.title ?? 'Your Meeting', msg)
        .catch(console.error);
    }
  }
}
