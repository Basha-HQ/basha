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
import {
  transcribeAudio,
  transcribeAndTranslateAudio,
  translateToEnglish,
  splitIntoSegments,
  transliterateToRoman,
  detectLanguageFromScript,
} from '@/lib/ai/sarvam';
import { generateSummary, generateMeetingTitle } from '@/lib/ai/summarize';
import { sendTranscriptReadyEmail } from '@/lib/email';
import {
  normalizeSpeaker,
  actualSpeakerIdsFromDiarized,
  windowsFromDiarized,
  resolveAndPersistSpeakerLabels,
} from '@/lib/recording/speakerLabels';

/**
 * Roman invariant: original_text must contain only Latin/ASCII characters
 * (plus punctuation, whitespace, digits, Latin Extended). Anything outside
 * this set is treated as native script leaking through and triggers retry.
 */
const NON_ROMAN_RE = /[^\p{ASCII}\p{P}\p{Z}\p{N}À-ɏ]/u;

/**
 * Cache the language resolved by Pipeline A so analytics + UI can read it.
 * Pipeline A is the single source of truth for spoken language — no fallback
 * chain, no browser locale, no sticky preferences (each meeting starts fresh).
 */
async function persistDetectedLanguage(meetingId: string, languageCode: string | null): Promise<void> {
  if (!languageCode) return;
  // Write to BOTH detected_language (analytics) and source_language (UI):
  // the transcript viewer renders its language badge from source_language.
  // Only overwrite source_language when it's blank or 'auto' so a user who
  // manually picked "Tamil" in the UI still gets that label.
  await query(
    `UPDATE meetings
     SET detected_language = COALESCE(detected_language, $1),
         source_language   = CASE
           WHEN source_language IS NULL OR source_language = 'auto' THEN $1
           ELSE source_language
         END
     WHERE id = $2`,
    [languageCode, meetingId]
  );
}

/**
 * Pull a Sarvam diarized entry's start time, normalising the various keys
 * Sarvam returns across endpoints/versions. Returns whole seconds.
 */
function diarizedStartSec(e: { start?: number } & Record<string, unknown>): number {
  const startRaw = e.start ?? e['start_time_seconds'] ?? e['start_time'] ?? e['start_ms'];
  if (typeof startRaw !== 'number' || !Number.isFinite(startRaw)) return 0;
  return startRaw > 3600 ? Math.round(startRaw / 1000) : Math.round(startRaw);
}

/**
 * Enforce the roman invariant on a transliteration result. If the output still
 * contains non-Roman script, retry with auto-lang and as a last resort fall
 * back to the English translation rather than ship native script.
 */
async function enforceRomanInvariant(
  segText: string,
  storedText: string,
  englishFallback: string,
  detectedLang: string | null
): Promise<string> {
  if (!NON_ROMAN_RE.test(storedText)) return storedText;
  console.error('[pipeline] Roman invariant violated — retrying with auto lang', {
    lang: detectedLang,
    sample: storedText.slice(0, 40),
  });
  try {
    const scriptDetected = detectLanguageFromScript(segText);
    const retry = await transliterateToRoman(segText, scriptDetected ?? 'auto');
    if (!NON_ROMAN_RE.test(retry)) return retry;
  } catch (err) {
    console.error('[pipeline] Auto-lang transliteration retry failed:', err instanceof Error ? err.message : err);
  }
  console.error('[pipeline] Roman invariant unrecoverable — falling back to English translation');
  return englishFallback;
}

export interface ChunkInput {
  meetingId: string;
  audioBuffer: Buffer;
  fileName: string;        // e.g. "uuid_chunk0.webm"
  chunkStartSeconds: number; // seconds elapsed since recording start (timestamp offset)
  sourceLanguage: string;
  speakingLanguage?: string; // user's profile speaking language — fallback for Latin-script code-mixed
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
  const { meetingId, audioBuffer, fileName, outputScript = 'roman' } = input;

  await query(
    `UPDATE meetings SET status = 'processing' WHERE id = $1`,
    [meetingId]
  );

  try {
    // ── Pipeline A — STT-translate ────────────────────────────────────────────
    // Sarvam's /speech-to-text-translate auto-detects the spoken language from
    // the audio and returns an English translation. The detected `language_code`
    // becomes the canonical hint for Pipeline B. No browser locale, no sticky
    // preference — each meeting is detected fresh from the audio.
    const pipelineA = await transcribeAndTranslateAudio(audioBuffer, fileName);
    const detectedLang =
      pipelineA.language_code && pipelineA.language_code !== 'unknown'
        ? pipelineA.language_code
        : null;
    console.log('[pipeline] Pipeline A — language:', detectedLang,
      '| english length:', pipelineA.transcript?.length,
      '| diarized:', pipelineA.diarized_entries?.length ?? 0);

    await persistDetectedLanguage(meetingId, detectedLang);

    // ── Pipeline B — STT (transcribe) — always runs ──────────────────────────
    // Run unconditionally even when detectedLang === 'en-IN': Sarvam frequently
    // misclassifies code-mixed Tanglish/Hinglish as pure English. Per-segment
    // detectLanguageFromScript below handles truly pure-English segments cheaply.
    const pipelineB = (detectedLang === 'en-IN' || !detectedLang)
      ? await transcribeAudio(audioBuffer, fileName, 'transcribe')
      : await transcribeAudio(audioBuffer, fileName, 'transcribe', detectedLang);
    console.log('[pipeline] Pipeline B — native transcript length:', pipelineB.transcript?.length,
      '| diarized:', pipelineB.diarized_entries?.length ?? 0);

    // Speaker label resolution from B (canonical diarization timeline)
    if (pipelineB.diarized_entries?.length) {
      await resolveAndPersistSpeakerLabels(
        meetingId,
        actualSpeakerIdsFromDiarized(pipelineB.diarized_entries),
        windowsFromDiarized(pipelineB.diarized_entries)
      );
    }

    // Build canonical segments from Pipeline B (or A if pure English)
    const rawBSegments: Array<{ text: string; startSeconds: number; speaker: string | null }> =
      pipelineB.diarized_entries?.length
        ? pipelineB.diarized_entries.map((e) => {
            const raw = e as unknown as Record<string, unknown>;
            const speaker = normalizeSpeaker(e.speaker ?? raw['speaker_id']);
            return {
              text: e.transcript ?? '',
              startSeconds: diarizedStartSec({ ...e, ...raw }),
              speaker,
            };
          })
        : splitIntoSegments(pipelineB.transcript ?? '', 0).map((s) => ({ ...s, speaker: null }));

    // Deduplicate segments — Sarvam diarization sometimes assigns the same
    // utterance to multiple speakers. Drop near-identical (text + timestamp).
    const seen: Array<{ text: string; startSeconds: number }> = [];
    const segments = rawBSegments.filter((seg) => {
      const norm = seg.text.trim().toLowerCase();
      const isDuplicate = seen.some(
        (s) => s.text === norm && Math.abs(s.startSeconds - seg.startSeconds) <= 2
      );
      if (!isDuplicate) seen.push({ text: norm, startSeconds: seg.startSeconds });
      return !isDuplicate;
    });
    console.log(`[pipeline] Segments after dedup: ${segments.length} (was ${rawBSegments.length})`);

    // Build a timestamp index of Pipeline A entries so we can match each
    // B-segment to A's English with a ±2s tolerance window. Used only for
    // non-English meetings; pure English just reuses A's text directly.
    const aIndex: Array<{ sec: number; text: string }> = pipelineA.diarized_entries?.length
      ? pipelineA.diarized_entries.map((e) => {
          const raw = e as unknown as Record<string, unknown>;
          return { sec: diarizedStartSec({ ...e, ...raw }), text: e.transcript ?? '' };
        })
      : [];

    function findEnglishForSegment(startSec: number): { english: string; matched: boolean } {
      let best: { sec: number; text: string; dist: number } | null = null;
      for (const a of aIndex) {
        const dist = Math.abs(a.sec - startSec);
        if (dist <= 2 && (!best || dist < best.dist)) best = { ...a, dist };
      }
      return best ? { english: best.text, matched: true } : { english: '', matched: false };
    }

    // ── Per-segment processing ───────────────────────────────────────────────
    // Per-segment script detection handles mid-meeting language switching:
    // each segment is checked independently so Tamil segments in an otherwise
    // English meeting get transliterated while English segments stay as-is.
    const englishSegments: string[] = [];
    for (let i = 0; i < segments.length; i++) {
      const seg = segments[i];
      let original: string;
      let english: string;

      const segScriptLang = detectLanguageFromScript(seg.text);
      const segIsEnglish = !segScriptLang && (detectedLang === 'en-IN' || !detectedLang);
      const segLang = segScriptLang ?? detectedLang;

      if (segIsEnglish) {
        original = seg.text;
        english = seg.text;
      } else if (outputScript === 'roman') {
        // English from Pipeline A (preferred) or fallback to text translation
        const match = findEnglishForSegment(seg.startSeconds);
        english = match.matched
          ? match.english
          : await translateToEnglish(seg.text, segLang);

        try {
          original = await transliterateToRoman(seg.text, segLang);
        } catch (err) {
          console.error('[pipeline] Transliteration threw — falling back to English:', err instanceof Error ? err.message : err);
          original = english;
        }
        original = await enforceRomanInvariant(seg.text, original, english, segLang);
      } else {
        // Non-roman output script — keep native, still get English from A
        const match = findEnglishForSegment(seg.startSeconds);
        english = match.matched
          ? match.english
          : await translateToEnglish(seg.text, segLang);
        original = seg.text;
      }
      englishSegments.push(english);

      await query(
        `INSERT INTO transcripts
           (meeting_id, segment_index, timestamp_seconds, original_text, english_text, speaker)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (meeting_id, segment_index) DO NOTHING`,
        [meetingId, i, seg.startSeconds, original, english, seg.speaker]
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
    outputScript = 'roman', isFinal, duration,
  } = input;

  // Only run STT if the chunk has meaningful audio (very small blobs = silence / empty tail)
  const MIN_AUDIO_BYTES = 5_000;
  if (audioBuffer.byteLength >= MIN_AUDIO_BYTES) {
    // ── Pipeline A — STT-translate (auto-detects language from audio) ──────
    const pipelineA = await transcribeAndTranslateAudio(audioBuffer, fileName);
    const detectedLang =
      pipelineA.language_code && pipelineA.language_code !== 'unknown'
        ? pipelineA.language_code
        : null;
    await persistDetectedLanguage(meetingId, detectedLang);

    console.log(
      `[pipeline:chunk] ${fileName} — A english len: ${pipelineA.transcript?.length}`,
      `| detected: ${detectedLang}`,
      `| chunkStart: ${chunkStartSeconds}s`
    );

    // ── Pipeline B — STT (transcribe) — always runs ──────────────────────────
    const pipelineB = (detectedLang === 'en-IN' || !detectedLang)
      ? await transcribeAudio(audioBuffer, fileName, 'transcribe')
      : await transcribeAudio(audioBuffer, fileName, 'transcribe', detectedLang);

    // Build segments from B (canonical), offsetting by chunkStartSeconds
    const rawSegments: Array<{ text: string; startSeconds: number; speaker: string | null }> =
      pipelineB.diarized_entries?.length
        ? pipelineB.diarized_entries.map((e) => {
            const raw = e as unknown as Record<string, unknown>;
            const localSec = diarizedStartSec({ ...e, ...raw });
            const speaker = normalizeSpeaker(e.speaker ?? raw['speaker_id']);
            return { text: e.transcript ?? '', startSeconds: chunkStartSeconds + localSec, speaker };
          })
        : splitIntoSegments(pipelineB.transcript ?? '', 30).map((s) => ({
            ...s,
            startSeconds: chunkStartSeconds + s.startSeconds,
            speaker: null,
          }));

    // Deduplicate near-identical segments (same text within 2s)
    const seenChunk: Array<{ text: string; startSeconds: number }> = [];
    const dedupedChunk = rawSegments.filter((seg) => {
      const norm = seg.text.trim().toLowerCase();
      const isDuplicate = seenChunk.some(
        (s) => s.text === norm && Math.abs(s.startSeconds - seg.startSeconds) <= 2
      );
      if (!isDuplicate) seenChunk.push({ text: norm, startSeconds: seg.startSeconds });
      return !isDuplicate;
    });

    // Index Pipeline A's diarized entries for ±2s timestamp matching
    const aIndex: Array<{ sec: number; text: string }> = pipelineA.diarized_entries?.length
      ? pipelineA.diarized_entries.map((e) => {
          const raw = e as unknown as Record<string, unknown>;
          return { sec: chunkStartSeconds + diarizedStartSec({ ...e, ...raw }), text: e.transcript ?? '' };
        })
      : [];

    // Continue numbering from the last inserted segment for this meeting
    const idxRow = await queryOne<{ max_index: number }>(
      `SELECT COALESCE(MAX(segment_index), -1) AS max_index FROM transcripts WHERE meeting_id = $1`,
      [meetingId]
    );
    const indexOffset = (idxRow?.max_index ?? -1) + 1;

    for (let i = 0; i < dedupedChunk.length; i++) {
      const seg = dedupedChunk[i];
      let original: string;
      let english: string;

      const segScriptLang = detectLanguageFromScript(seg.text);
      const segIsEnglish = !segScriptLang && (detectedLang === 'en-IN' || !detectedLang);
      const segLang = segScriptLang ?? detectedLang;

      if (segIsEnglish) {
        original = seg.text;
        english = seg.text;
      } else if (outputScript === 'roman') {
        // English: closest A-segment by timestamp; fall back to text translation
        let aMatch: { sec: number; text: string; dist: number } | null = null;
        for (const a of aIndex) {
          const dist = Math.abs(a.sec - seg.startSeconds);
          if (dist <= 2 && (!aMatch || dist < aMatch.dist)) aMatch = { ...a, dist };
        }
        english = aMatch ? aMatch.text : await translateToEnglish(seg.text, segLang);

        try {
          original = await transliterateToRoman(seg.text, segLang);
        } catch (err) {
          console.error('[pipeline:chunk] Transliteration threw — falling back to English:', err instanceof Error ? err.message : err);
          original = english;
        }
        original = await enforceRomanInvariant(seg.text, original, english, segLang);
      } else {
        let aMatch: { sec: number; text: string; dist: number } | null = null;
        for (const a of aIndex) {
          const dist = Math.abs(a.sec - seg.startSeconds);
          if (dist <= 2 && (!aMatch || dist < aMatch.dist)) aMatch = { ...a, dist };
        }
        english = aMatch ? aMatch.text : await translateToEnglish(seg.text, segLang);
        original = seg.text;
      }

      await query(
        `INSERT INTO transcripts
           (meeting_id, segment_index, timestamp_seconds, original_text, english_text, speaker)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (meeting_id, segment_index) DO NOTHING`,
        [meetingId, indexOffset + i, seg.startSeconds, original, english, seg.speaker]
      );
    }

    // Persist source_language (for downstream UI / language badge) if not set
    if (detectedLang) {
      await query(
        `UPDATE meetings SET source_language = $1
         WHERE id = $2 AND (source_language IS NULL OR source_language = 'auto')`,
        [detectedLang, meetingId]
      );
    }
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
