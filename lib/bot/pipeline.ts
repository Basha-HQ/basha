/**
 * Bot processing pipeline (Recall.ai path).
 * Downloads audio from Recall.ai, then delegates to the shared recording pipeline.
 *
 * Imported by:
 *   - app/api/bots/[id]/route.ts        (polling path)
 *   - app/api/webhooks/recall/route.ts  (webhook path)
 */

import { query, queryOne } from '@/lib/db';
import {
  getRecordingUrl,
  fetchRecallTranscript,
  fetchMeetingParticipants,
  deriveSpeakingWindows,
  getRecordingStartIso,
  type RecallBot,
  type SpeakingWindow,
} from '@/lib/recall/client';
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

    // 4. Fetch source_language for the meeting + user's speaking_language preference
    const [meeting, userPrefs] = await Promise.all([
      queryOne<{ source_language: string }>(
        'SELECT source_language FROM meetings WHERE id = $1',
        [bot.meeting_id]
      ),
      queryOne<{ speaking_language: string }>(
        'SELECT speaking_language FROM users WHERE id = $1',
        [userId]
      ),
    ]);

    // 5. Delegate to shared pipeline
    await processAudioForMeeting({
      meetingId: bot.meeting_id,
      audioBuffer,
      fileName: `${bot.meeting_id}.${ext}`,
      sourceLanguage: meeting?.source_language ?? 'auto',
      speakingLanguage: userPrefs?.speaking_language ?? undefined,
    });

    // 6. Auto-assign real participant names from Recall.ai.
    //    Sarvam gives us SPEAKER_XX IDs + timestamps; Recall.ai knows the actual
    //    participant names and when each one was the active speaker.
    //    Strategy: try the transcript first (most precise), then fall back to
    //    participant event windows (active_speaker timeline). Either way, we
    //    cross-reference timestamps against our saved transcripts and assign
    //    the majority-vote name per SPEAKER_XX.
    try {
      const savedRows = await query<{ speaker: string; timestamp_seconds: number }>(
        `SELECT speaker, timestamp_seconds FROM transcripts
         WHERE meeting_id = $1 AND speaker IS NOT NULL
         ORDER BY segment_index`,
        [bot.meeting_id]
      );

      if (savedRows.length > 0) {
        // Build speaking windows: prefer transcript (word-aligned), else
        // participant active_speaker events.
        let speakingWindows: SpeakingWindow[] = [];
        const transcriptUrl = recallBot.recordings?.[0]
          ?.media_shortcuts?.transcript?.data?.download_url;
        if (transcriptUrl) {
          const recallSegments = await fetchRecallTranscript(transcriptUrl);
          speakingWindows = recallSegments.map((s) => ({
            name: s.speaker,
            start_seconds: s.start_time,
            end_seconds: s.end_time,
          }));
          console.log(`[bot-pipeline] Recall.ai transcript: ${speakingWindows.length} segments`);
        }

        if (speakingWindows.length === 0 && bot.recall_bot_id) {
          // Fallback — participant events
          const participants = await fetchMeetingParticipants(bot.recall_bot_id);
          const recordingStart = getRecordingStartIso(recallBot);
          if (recordingStart && participants.length > 0) {
            speakingWindows = deriveSpeakingWindows(participants, recordingStart);
            console.log(`[bot-pipeline] Participant events: ${participants.length} participants, ${speakingWindows.length} windows`);
          }
        }

        if (speakingWindows.length > 0) {
          // Tally: SPEAKER_XX → { "Name": voteCount }
          const tally: Record<string, Record<string, number>> = {};
          for (const row of savedRows) {
            const ts = row.timestamp_seconds ?? 0;
            // Pick the speaking window covering this timestamp (±2s slack)
            const match = speakingWindows.find(
              (w) => ts >= w.start_seconds - 2 && ts <= w.end_seconds + 2
            );
            if (!match?.name) continue;
            if (!tally[row.speaker]) tally[row.speaker] = {};
            tally[row.speaker][match.name] = (tally[row.speaker][match.name] ?? 0) + 1;
          }

          // For SPEAKER_XX with no timestamp matches at all, fall back to the
          // single most-active participant overall — covers cases where multiple
          // Sarvam speakers share one mic (e.g. notetaker + nearby person).
          const allRowSpeakers = Array.from(new Set(savedRows.map((r) => r.speaker)));
          if (allRowSpeakers.some((s) => !tally[s])) {
            const overall: Record<string, number> = {};
            for (const w of speakingWindows) {
              const dur = Math.max(1, w.end_seconds - w.start_seconds);
              overall[w.name] = (overall[w.name] ?? 0) + dur;
            }
            const topName = Object.entries(overall).sort((a, b) => b[1] - a[1])[0]?.[0];
            if (topName) {
              for (const s of allRowSpeakers) {
                if (!tally[s]) tally[s] = { [topName]: 1 };
              }
            }
          }

          const speakerLabels: Record<string, string> = {};
          for (const [speakerId, votes] of Object.entries(tally)) {
            const name = Object.entries(votes).sort((a, b) => b[1] - a[1])[0]?.[0];
            if (name) speakerLabels[speakerId] = name;
          }

          if (Object.keys(speakerLabels).length > 0) {
            await query(
              `UPDATE meetings SET speaker_labels = $1 WHERE id = $2`,
              [JSON.stringify(speakerLabels), bot.meeting_id]
            );
            console.log(`[bot-pipeline] Speaker labels set from Recall.ai:`, speakerLabels);
          } else {
            console.warn('[bot-pipeline] No speaker label matches produced — keeping fallback labels');
          }
        } else {
          console.warn('[bot-pipeline] No Recall.ai speaking data available (transcript + participants both empty)');
        }
      }
    } catch (err) {
      // Non-fatal — naming is best-effort
      console.warn('[bot-pipeline] Recall.ai speaker naming failed:', err);
    }

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
