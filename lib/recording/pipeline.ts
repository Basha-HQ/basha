/**
 * Shared AI processing pipeline.
 * Accepts an audioBuffer + meetingId and runs:
 *   Sarvam STT → translate → summarize → update DB
 *
 * Called by:
 *   - lib/bot/pipeline.ts              (Recall.ai bot path)
 *   - app/api/extension/upload/route.ts (Chrome extension path)
 *   - app/api/meetings/[id]/process/route.ts (manual upload path)
 */

import { query, queryOne } from '@/lib/db';
import { transcribeAudio, translateToEnglish, splitIntoSegments } from '@/lib/ai/sarvam';
import { generateSummary, generateMeetingTitle } from '@/lib/ai/summarize';

export interface ProcessingInput {
  meetingId: string;
  audioBuffer: Buffer;
  fileName: string;        // e.g. "uuid.webm" — determines MIME type for Sarvam
  sourceLanguage: string;  // e.g. "ta-IN" or "auto"
}

export async function processAudioForMeeting(input: ProcessingInput): Promise<void> {
  const { meetingId, audioBuffer, fileName, sourceLanguage } = input;

  await query(
    `UPDATE meetings SET status = 'processing' WHERE id = $1`,
    [meetingId]
  );

  try {
    // 1. Transcribe with Sarvam AI (WebM/Opus, MP4, WAV, MP3 all supported)
    const sttResult = await transcribeAudio(audioBuffer, fileName);

    console.log('[pipeline] STT result — transcript length:', sttResult.transcript?.length,
      '| language:', sttResult.language_code,
      '| diarized entries:', sttResult.diarized_entries?.length ?? 0);
    console.log('[pipeline] Transcript preview:', JSON.stringify((sttResult.transcript ?? '').slice(0, 300)));

    if (sttResult.diarized_entries?.length) {
      console.log('[pipeline] Sarvam diarized entry[0]:', JSON.stringify(sttResult.diarized_entries[0]));
    } else {
      console.log('[pipeline] No diarized_entries — using sentence-split fallback');
    }

    // Resolve detected language, falling back to per-meeting source_language
    const detectedLang =
      sttResult.language_code && sttResult.language_code !== 'unknown'
        ? sttResult.language_code
        : (sourceLanguage ?? 'auto');

    // 2. Build segments — prefer diarized (real timestamps + speaker) over sentence split
    const segments: Array<{ text: string; startSeconds: number; speaker: string | null }> =
      sttResult.diarized_entries?.length
        ? sttResult.diarized_entries.map((e) => {
            const raw = e as unknown as Record<string, unknown>;
            const startRaw = e.start ?? raw['start_time'] ?? raw['start_ms'];
            const startSec =
              typeof startRaw === 'number' && Number.isFinite(startRaw)
                ? startRaw > 3600 ? Math.round(startRaw / 1000) : Math.round(startRaw)
                : 0;
            return {
              text: e.transcript,
              startSeconds: startSec,
              speaker: e.speaker ?? null,
            };
          })
        : splitIntoSegments(sttResult.transcript, 0).map((s) => ({ ...s, speaker: null }));

    console.log('[pipeline] Segments to process:', segments.length);
    if (segments.length > 0) {
      console.log('[pipeline] First segment:', JSON.stringify(segments[0]));
    }

    // 3. Translate each segment + insert transcript rows
    const englishSegments: string[] = [];
    for (let i = 0; i < segments.length; i++) {
      const seg = segments[i];
      const en = await translateToEnglish(seg.text, detectedLang);
      englishSegments.push(en);

      await query(
        `INSERT INTO transcripts
           (meeting_id, segment_index, timestamp_seconds, original_text, english_text, speaker)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [meetingId, i, seg.startSeconds, seg.text, en, seg.speaker]
      );
    }

    // 4. Fetch title for summary context
    const meeting = await queryOne<{ title: string }>(
      'SELECT title FROM meetings WHERE id = $1',
      [meetingId]
    );

    // 5. Generate summary + AI title
    const fullEnglish = englishSegments.join(' ');
    const summary = await generateSummary(fullEnglish, meeting?.title);
    const aiTitle = await generateMeetingTitle(summary);

    // 6. Mark completed
    await query(
      `UPDATE meetings
       SET status = 'completed', summary = $1, completed_at = NOW()${aiTitle ? ', title = $3' : ''}
       WHERE id = $2`,
      aiTitle
        ? [JSON.stringify(summary), meetingId, aiTitle]
        : [JSON.stringify(summary), meetingId]
    );

    console.log(`[pipeline] Processing complete for meeting ${meetingId}`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[pipeline] Processing error:', msg);
    await query(
      `UPDATE meetings SET status = 'failed' WHERE id = $1`,
      [meetingId]
    );
    throw err; // re-throw so callers can update their own status tables (e.g. bots)
  }
}
