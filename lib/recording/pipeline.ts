/**
 * Shared AI processing pipeline.
 * Accepts an audioBuffer + meetingId and runs:
 *   Sarvam STT → translate → summarize → update DB
 *
 * Called by:
 *   - lib/bot/pipeline.ts              (Recall.ai bot path)
 *   - app/api/extension/upload/route.ts (Chrome extension path — full file, ≤7 min)
 *   - app/api/extension/chunk/route.ts  (Chrome extension path — 30s chunks, unlimited)
 *   - app/api/meetings/[id]/process/route.ts (manual upload path)
 */

import { query, queryOne } from '@/lib/db';
import { transcribeAudio, translateToEnglish, splitIntoSegments, transliterateToRoman } from '@/lib/ai/sarvam';
import { generateSummary, generateMeetingTitle } from '@/lib/ai/summarize';
import { sendTranscriptReadyEmail } from '@/lib/email';
import {
  normalizeSpeaker,
  actualSpeakerIdsFromDiarized,
  windowsFromDiarized,
  resolveAndPersistSpeakerLabels,
} from '@/lib/recording/speakerLabels';

export interface ChunkInput {
  meetingId: string;
  audioBuffer: Buffer;
  fileName: string;        // e.g. "uuid_chunk0.webm"
  chunkStartSeconds: number; // seconds elapsed since recording start (timestamp offset)
  sourceLanguage: string;
  outputScript?: 'roman' | 'fully-native' | 'spoken-form-in-native';
  isFinal: boolean;        // true on last chunk → triggers summary + completion
  duration?: number;       // total meeting duration (seconds), only on final chunk
}

export interface ProcessingInput {
  meetingId: string;
  audioBuffer: Buffer;
  fileName: string;        // e.g. "uuid.webm" — determines MIME type for Sarvam
  sourceLanguage: string;  // e.g. "ta-IN" or "auto"
  outputScript?: 'roman' | 'fully-native' | 'spoken-form-in-native';  // default: 'roman'
  speakingLanguage?: string; // user's profile speaking language (e.g. 'ta') — used in translit mode
}

export async function processAudioForMeeting(input: ProcessingInput): Promise<void> {
  const { meetingId, audioBuffer, fileName, sourceLanguage, outputScript = 'roman', speakingLanguage } = input;

  await query(
    `UPDATE meetings SET status = 'processing' WHERE id = $1`,
    [meetingId]
  );

  try {
    // 1. Transcribe with Sarvam AI (WebM/Opus, MP4, WAV, MP3 all supported)
    // Always use 'transcribe' mode (native script) so we can run transliteration
    // and translation in parallel from the same source text.
    // Roman output is produced separately via transliterateToRoman.
    const sttMode = 'transcribe';
    // Pass the user's speaking language as a hint so Sarvam returns native script
    // even for code-mixed Tamil-English recordings (without this it auto-detects en-IN).
    const INDIAN_LANGS = ['ta', 'hi', 'te', 'kn', 'ml', 'mr', 'bn', 'gu', 'pa', 'or'];
    const sttLanguageCode = speakingLanguage && INDIAN_LANGS.includes(speakingLanguage)
      ? `${speakingLanguage}-IN`
      : undefined;
    const sttResult = await transcribeAudio(audioBuffer, fileName, sttMode, sttLanguageCode);

    console.log('[pipeline] STT result — transcript length:', sttResult.transcript?.length,
      '| language:', sttResult.language_code,
      '| diarized entries:', sttResult.diarized_entries?.length ?? 0);
    console.log('[pipeline] Transcript preview:', JSON.stringify((sttResult.transcript ?? '').slice(0, 300)));

    if (sttResult.diarized_entries?.length) {
      console.log('[pipeline] Sarvam diarized entry[0]:', JSON.stringify(sttResult.diarized_entries[0]));
    } else {
      console.log('[pipeline] No diarized_entries — using sentence-split fallback');
    }

    // Resolve language for translation.
    // Priority:
    //   1. Explicit sourceLanguage (user-set, not 'auto')
    //   2. Sarvam-detected non-English language (trust clear detections)
    //   3. User's speaking_language profile preference (overrides English mis-detection
    //      on code-mixed Indian-English recordings where Sarvam often returns 'en-IN')
    //   4. Sarvam-detected English (last resort)
    const sttLang = sttResult.language_code && sttResult.language_code !== 'unknown'
      ? sttResult.language_code
      : null;
    const speakingLangCode = speakingLanguage && INDIAN_LANGS.includes(speakingLanguage)
      ? `${speakingLanguage}-IN`
      : null;
    const detectedLang: string | null =
      (sourceLanguage && sourceLanguage !== 'auto')
        ? sourceLanguage
        : (sttLang && sttLang !== 'en-IN')
          ? sttLang
          : speakingLangCode ?? sttLang ?? null;

    // 1b. Resolve real speaker names for Sarvam's SPEAKER_XX IDs. See
    // lib/recording/speakerLabels.ts for the 3-tier fallback strategy.
    if (sttResult.diarized_entries?.length) {
      await resolveAndPersistSpeakerLabels(
        meetingId,
        actualSpeakerIdsFromDiarized(sttResult.diarized_entries),
        windowsFromDiarized(sttResult.diarized_entries)
      );
    }

    // 2. Build segments — prefer diarized (real timestamps + speaker) over sentence split
    const segments: Array<{ text: string; startSeconds: number; speaker: string | null }> =
      sttResult.diarized_entries?.length
        ? sttResult.diarized_entries.map((e) => {
            const raw = e as unknown as Record<string, unknown>;
            const startRaw =
              e.start ??
              raw['start_time_seconds'] ??
              raw['start_time'] ??
              raw['start_ms'];
            const startSec =
              typeof startRaw === 'number' && Number.isFinite(startRaw)
                ? startRaw > 3600 ? Math.round(startRaw / 1000) : Math.round(startRaw)
                : 0;
            const speaker = normalizeSpeaker(e.speaker ?? raw['speaker_id']);
            return {
              text: e.transcript,
              startSeconds: startSec,
              speaker,
            };
          })
        : splitIntoSegments(sttResult.transcript, 0).map((s) => ({ ...s, speaker: null }));

    console.log('[pipeline] Segments to process:', segments.length);
    if (segments.length > 0) {
      console.log('[pipeline] First segment:', JSON.stringify(segments[0]));
    }

    // 3. Translate + transliterate each segment, then insert transcript rows.
    // For roman outputScript: run translation (native → English) and transliteration
    // (native → Roman) in parallel from the same native-script STT output.
    // For native outputScript: just translate to English, store native script as-is.
    const englishSegments: string[] = [];
    for (let i = 0; i < segments.length; i++) {
      const seg = segments[i];
      let en: string;
      let storedText: string;

      if (outputScript === 'roman') {
        [en, storedText] = await Promise.all([
          translateToEnglish(seg.text, detectedLang),
          transliterateToRoman(seg.text, detectedLang),
        ]);
      } else {
        en = await translateToEnglish(seg.text, detectedLang);
        storedText = seg.text;
      }
      englishSegments.push(en);

      await query(
        `INSERT INTO transcripts
           (meeting_id, segment_index, timestamp_seconds, original_text, english_text, speaker)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [meetingId, i, seg.startSeconds, storedText, en, seg.speaker]
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
    // Fallback: extract first 7 words of overview when AI title generation fails
    const effectiveTitle = aiTitle ||
      (summary.overview
        ? summary.overview.replace(/\s+/g, ' ').trim().split(/\s+/).slice(0, 7).join(' ')
        : null);

    // 6. Mark completed — also persist the detected language so meeting cards can show it
    await query(
      `UPDATE meetings
       SET status = 'completed', summary = $1, source_language = $3, completed_at = NOW()${effectiveTitle ? ', title = $4' : ''}
       WHERE id = $2`,
      effectiveTitle
        ? [JSON.stringify(summary), meetingId, detectedLang, effectiveTitle]
        : [JSON.stringify(summary), meetingId, detectedLang]
    );

    console.log(`[pipeline] Processing complete for meeting ${meetingId}`);

    // 7. Send "transcript ready" email with full summary embedded
    const userRow = await queryOne<{ email: string; name: string }>(
      `SELECT u.email, u.name FROM users u JOIN meetings m ON m.user_id = u.id WHERE m.id = $1`,
      [meetingId]
    ).catch(() => null);
    if (userRow) {
      const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? '';
      sendTranscriptReadyEmail(
        userRow.email,
        userRow.name,
        effectiveTitle ?? 'Your Meeting',
        summary,
        `${appUrl}/meetings/${meetingId}`
      ).catch(console.error); // fire-and-forget — never block the pipeline
    }
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

/**
 * Process a single 30-second audio chunk from the Chrome extension.
 * Runs STT → translate → insert transcript rows immediately.
 * On the final chunk, generates summary and marks the meeting completed.
 *
 * This enables unlimited meeting length by sidestepping Vercel's 4.5 MB body limit
 * and Sarvam's batch job timeout — each ≤30s chunk uses the fast sync STT API.
 */
export async function processAudioChunk(input: ChunkInput): Promise<void> {
  const {
    meetingId, audioBuffer, fileName, chunkStartSeconds,
    sourceLanguage, outputScript = 'roman', isFinal, duration,
  } = input;

  const sttMode = 'transcribe';  // always native script; Roman is produced via transliterateToRoman

  // Only run STT if the chunk has meaningful audio (very small blobs = silence / empty tail)
  const MIN_AUDIO_BYTES = 5_000;
  if (audioBuffer.byteLength >= MIN_AUDIO_BYTES) {
    const sttResult = await transcribeAudio(audioBuffer, fileName, sttMode);

    const detectedLang =
      sourceLanguage && sourceLanguage !== 'auto'
        ? sourceLanguage
        : sttResult.language_code && sttResult.language_code !== 'unknown'
          ? sttResult.language_code
          : 'auto';

    console.log(
      `[pipeline:chunk] ${fileName} — transcript length: ${sttResult.transcript?.length}`,
      `| sttMode: ${sttMode}`,
      `| stt language_code: ${sttResult.language_code}`,
      `| detectedLang: ${detectedLang}`,
      `| diarized: ${sttResult.diarized_entries?.length ?? 0}`,
      `| chunkStart: ${chunkStartSeconds}s`
    );

    // Build segments, offsetting timestamps by chunkStartSeconds
    const rawSegments: Array<{ text: string; startSeconds: number; speaker: string | null }> =
      sttResult.diarized_entries?.length
        ? sttResult.diarized_entries.map((e) => {
            const raw = e as unknown as Record<string, unknown>;
            const startRaw = e.start ?? raw['start_time_seconds'] ?? raw['start_time'] ?? raw['start_ms'];
            const localSec =
              typeof startRaw === 'number' && Number.isFinite(startRaw)
                ? startRaw > 3600 ? Math.round(startRaw / 1000) : Math.round(startRaw)
                : 0;
            const speaker = normalizeSpeaker(e.speaker ?? raw['speaker_id']);
            return { text: e.transcript, startSeconds: chunkStartSeconds + localSec, speaker };
          })
        : splitIntoSegments(sttResult.transcript, 30).map((s) => ({
            ...s,
            startSeconds: chunkStartSeconds + s.startSeconds,
            speaker: null,
          }));

    // Determine index offset — continue numbering from last inserted segment
    const idxRow = await queryOne<{ max_index: number }>(
      `SELECT COALESCE(MAX(segment_index), -1) AS max_index FROM transcripts WHERE meeting_id = $1`,
      [meetingId]
    );
    const indexOffset = (idxRow?.max_index ?? -1) + 1;

    // Translate + transliterate each segment in parallel (roman mode), or just translate (native)
    for (let i = 0; i < rawSegments.length; i++) {
      const seg = rawSegments[i];
      let en: string;
      let storedText: string;

      if (outputScript === 'roman') {
        [en, storedText] = await Promise.all([
          translateToEnglish(seg.text, detectedLang),
          transliterateToRoman(seg.text, detectedLang),
        ]);
      } else {
        en = await translateToEnglish(seg.text, detectedLang);
        storedText = seg.text;
      }

      await query(
        `INSERT INTO transcripts
           (meeting_id, segment_index, timestamp_seconds, original_text, english_text, speaker)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [meetingId, indexOffset + i, seg.startSeconds, storedText, en, seg.speaker]
      );
    }

    // Persist detected language if not yet set
    await query(
      `UPDATE meetings SET source_language = $1
       WHERE id = $2 AND (source_language IS NULL OR source_language = 'auto')`,
      [detectedLang, meetingId]
    );
  } else {
    console.log(`[pipeline:chunk] ${fileName} — skipped STT (too small: ${audioBuffer.byteLength} bytes)`);
  }

  if (!isFinal) return;

  // ── Final chunk: generate summary and mark completed ──────────────────────
  if (duration != null) {
    await query(`UPDATE meetings SET status = 'processing', duration = $1 WHERE id = $2`, [duration, meetingId]);
  } else {
    await query(`UPDATE meetings SET status = 'processing' WHERE id = $1`, [meetingId]);
  }

  // Gather all translated segments across all chunks
  const allRows = await query<{ english_text: string }>(
    `SELECT english_text FROM transcripts WHERE meeting_id = $1 ORDER BY segment_index`,
    [meetingId]
  );
  const fullEnglish = allRows.map((r) => r.english_text).join(' ');

  if (!fullEnglish.trim()) {
    await query(`UPDATE meetings SET status = 'failed' WHERE id = $1`, [meetingId]);
    console.error(`[pipeline:chunk] No transcript produced for meeting ${meetingId}`);
    return;
  }

  const meeting = await queryOne<{ title: string }>('SELECT title FROM meetings WHERE id = $1', [meetingId]);
  const summary = await generateSummary(fullEnglish, meeting?.title);
  const aiTitle = await generateMeetingTitle(summary);
  const effectiveTitle = aiTitle ||
    (summary.overview
      ? summary.overview.replace(/\s+/g, ' ').trim().split(/\s+/).slice(0, 7).join(' ')
      : null);

  if (effectiveTitle) {
    await query(
      `UPDATE meetings SET status = 'completed', summary = $1, title = $2, completed_at = NOW() WHERE id = $3`,
      [JSON.stringify(summary), effectiveTitle, meetingId]
    );
  } else {
    await query(
      `UPDATE meetings SET status = 'completed', summary = $1, completed_at = NOW() WHERE id = $2`,
      [JSON.stringify(summary), meetingId]
    );
  }

  console.log(`[pipeline:chunk] Meeting ${meetingId} completed`);

  // Send transcript-ready email
  const userRow = await queryOne<{ email: string; name: string }>(
    `SELECT u.email, u.name FROM users u JOIN meetings m ON m.user_id = u.id WHERE m.id = $1`,
    [meetingId]
  ).catch(() => null);
  if (userRow) {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? '';
    sendTranscriptReadyEmail(
      userRow.email,
      userRow.name,
      aiTitle ?? 'Your Meeting',
      summary,
      `${appUrl}/meetings/${meetingId}`
    ).catch(console.error);
  }
}
