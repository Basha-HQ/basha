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
  type SarvamSTTResponse,
} from '@/lib/ai/sarvam';
import { generateSummary, generateMeetingTitle, type MeetingSummary } from '@/lib/ai/summarize';
import { sendTranscriptReadyEmail } from '@/lib/email';
import {
  normalizeSpeaker,
  actualSpeakerIdsFromDiarized,
  windowsFromDiarized,
  resolveAndPersistSpeakerLabels,
} from '@/lib/recording/speakerLabels';

/**
 * Retry a Sarvam STT call once if it times out (transient queue congestion).
 * Any other error is re-thrown immediately.
 */
async function withSarvamRetry(fn: () => Promise<SarvamSTTResponse>): Promise<SarvamSTTResponse> {
  try {
    return await fn();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.toLowerCase().includes('timed out') || msg.toLowerCase().includes('timeout')) {
      console.warn('[pipeline] Sarvam timed out — retrying once in 5s…');
      await new Promise((r) => setTimeout(r, 5000));
      return fn();
    }
    throw err;
  }
}

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
  const { meetingId, audioBuffer, fileName, outputScript = 'roman', speakingLanguage } = input;
  const pipelineStart = Date.now();
  console.log(`[pipeline] Starting pipeline for meeting ${meetingId} — file: ${fileName}, size: ${(audioBuffer.byteLength / 1024).toFixed(0)}KB`);

  console.log(`[pipeline] Meeting ${meetingId} status → processing`);
  await query(
    `UPDATE meetings SET status = 'processing' WHERE id = $1`,
    [meetingId]
  );

  let step = 'init';
  try {
    // ── Pipeline A — STT-translate ────────────────────────────────────────────
    // Sarvam's /speech-to-text-translate auto-detects the spoken language from
    // the audio and returns an English translation. The detected `language_code`
    // becomes the canonical hint for Pipeline B. No browser locale, no sticky
    // preference — each meeting is detected fresh from the audio.
    const pipelineA = await withSarvamRetry(() => transcribeAndTranslateAudio(audioBuffer, fileName));
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
      ? await withSarvamRetry(() => transcribeAudio(audioBuffer, fileName, 'transcribe'))
      : await withSarvamRetry(() => transcribeAudio(audioBuffer, fileName, 'transcribe', detectedLang!));
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
    // Batched parallel processing (10 at a time) — each segment's translate +
    // transliterate calls are independent so we run them concurrently. English-only
    // segments skip all API calls so the concurrency only fires where it matters.
    const SEGMENT_BATCH = 10;
    const englishSegments: string[] = new Array(segments.length).fill('');
    for (let batchStart = 0; batchStart < segments.length; batchStart += SEGMENT_BATCH) {
      const batchEnd = Math.min(batchStart + SEGMENT_BATCH, segments.length);
      console.log(`[pipeline] Segments ${batchStart + 1}–${batchEnd}/${segments.length}`);
      await Promise.all(
        segments.slice(batchStart, batchEnd).map(async (seg, batchIdx) => {
          const i = batchStart + batchIdx;
          let original: string;
          let english: string;

          const segScriptLang = detectLanguageFromScript(seg.text);
          // If the user's profile speaking_language is non-English, treat Latin-script
          // segments as potentially Romanized native text (Tanglish/Hinglish) — Sarvam
          // often misclassifies these as pure English at the audio level.
          const userPrefsNonEnglish = !!speakingLanguage && speakingLanguage !== 'en' && speakingLanguage !== 'en-IN';
          const segIsEnglish = !segScriptLang
            && (detectedLang === 'en-IN' || !detectedLang)
            && !userPrefsNonEnglish;
          // When Sarvam detected a non-English language for the whole audio, Latin-script
          // segments (Tanglish/Hinglish code-mixing) inherit that language so they get
          // translated rather than silently skipped.
          const isKnownNonEnglish = !!detectedLang && detectedLang !== 'unknown' && detectedLang !== 'en-IN' && detectedLang !== 'en';
          const segLang = segScriptLang ?? (isKnownNonEnglish ? detectedLang : (userPrefsNonEnglish ? speakingLanguage : detectedLang));

          if (segIsEnglish) {
            // Even when classified English, Pipeline A may have produced a different
            // English translation — that's a signal the source was actually non-English
            // (Sarvam translate succeeded but Sarvam STT-language-detection misclassified).
            const aMatch = findEnglishForSegment(seg.startSeconds);
            const aText = aMatch.matched ? aMatch.english.trim() : '';
            const ogText = seg.text.trim();
            const differs = aText.length > 0
              && aText.toLowerCase() !== ogText.toLowerCase()
              && Math.abs(aText.length - ogText.length) > 3;
            original = seg.text;
            english = differs ? aMatch.english : seg.text;
          } else if (outputScript === 'roman') {
            // English from Pipeline A (preferred) or fallback to text translation
            const match = findEnglishForSegment(seg.startSeconds);
            english = match.matched
              ? match.english
              : await translateToEnglish(seg.text, segLang);

            // Skip transliteration when segment is already Roman or language is unknown/English
            const skipTranslit = !segLang || segLang === 'en-IN' || segLang === 'en' || segLang === 'unknown';
            if (skipTranslit) {
              original = seg.text;
            } else {
              try {
                original = await transliterateToRoman(seg.text, segLang);
              } catch (err) {
                console.error('[pipeline] Transliteration threw — falling back to English:', err instanceof Error ? err.message : err);
                original = english;
              }
              original = await enforceRomanInvariant(seg.text, original, english, segLang);
            }
          } else {
            // Non-roman output script — keep native, still get English from A
            const match = findEnglishForSegment(seg.startSeconds);
            english = match.matched
              ? match.english
              : await translateToEnglish(seg.text, segLang);
            original = seg.text;
          }
          englishSegments[i] = english;

          await query(
            `INSERT INTO transcripts
               (meeting_id, segment_index, timestamp_seconds, original_text, english_text, speaker)
             VALUES ($1, $2, $3, $4, $5, $6)
             ON CONFLICT (meeting_id, segment_index) DO NOTHING`,
            [meetingId, i, seg.startSeconds, original, english, seg.speaker]
          );
        })
      );
    }

    console.log(`[pipeline] Inserted ${segments.length} transcript segments for meeting ${meetingId}`);

    // 4. Fetch title for summary context
    step = 'summary';
    const meeting = await queryOne<{ title: string }>(
      'SELECT title FROM meetings WHERE id = $1',
      [meetingId]
    );

    // 5. Generate summary + AI title — non-fatal: transcript is already saved
    const fullEnglish = englishSegments.join(' ');
    let summary: MeetingSummary = { topics: [], decisions: [], notes: [], rawSummary: '' };
    let aiTitle = '';
    try {
      summary = await generateSummary(fullEnglish, meeting?.title);
      aiTitle = await generateMeetingTitle(summary);
    } catch (summaryErr) {
      const summaryMsg = summaryErr instanceof Error ? summaryErr.message : String(summaryErr);
      console.error(`[pipeline] Summary generation failed (non-fatal) — meeting will still complete: ${summaryMsg}`);
      summary = { topics: [], decisions: [], notes: [], rawSummary: '' };
    }
    // Fallback: extract first 7 words of overview when AI title generation fails
    const effectiveTitle = aiTitle ||
      (summary.overview
        ? summary.overview.replace(/\s+/g, ' ').trim().split(/\s+/).slice(0, 6).join(' ')
        : null);
    console.log(`[pipeline] Summary generated — topics: ${summary.topics.length}, decisions: ${summary.decisions.length}, title: "${effectiveTitle ?? '(none)'}"`);

    // 6. Mark completed — also persist the detected language so meeting cards can show it.
    //    Prefer the user's profile speaking_language over a suspect 'en-IN' detection,
    //    since Sarvam frequently misclassifies code-mixed Tanglish/Hinglish audio.
    let effectiveLanguage = detectedLang;
    if (
      (detectedLang === 'en-IN' || !detectedLang) &&
      speakingLanguage &&
      speakingLanguage !== 'en' &&
      speakingLanguage !== 'en-IN' &&
      speakingLanguage !== 'auto'
    ) {
      effectiveLanguage = /-/.test(speakingLanguage) ? speakingLanguage : `${speakingLanguage}-IN`;
    }

    step = 'db-complete';
    console.log(`[pipeline] Meeting ${meetingId} status → completed`);
    await query(
      `UPDATE meetings
       SET status = 'completed', summary = $1, source_language = $3, completed_at = NOW()${effectiveTitle ? ', title = $4' : ''}
       WHERE id = $2`,
      effectiveTitle
        ? [JSON.stringify(summary), meetingId, effectiveLanguage, effectiveTitle]
        : [JSON.stringify(summary), meetingId, effectiveLanguage]
    );

    // 7. Send "transcript ready" email with full summary embedded
    const userRow = await queryOne<{ email: string; name: string }>(
      `SELECT u.email, u.name FROM users u JOIN meetings m ON m.user_id = u.id WHERE m.id = $1`,
      [meetingId]
    ).catch(() => null);
    if (userRow) {
      console.log(`[pipeline] Sending transcript-ready email to ${userRow.email}`);
      const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? '';
      sendTranscriptReadyEmail(
        userRow.email,
        userRow.name,
        effectiveTitle ?? 'Your Meeting',
        summary,
        `${appUrl}/meetings/${meetingId}`
      ).catch(console.error); // fire-and-forget — never block the pipeline
    }

    console.log(`[pipeline] Pipeline complete for meeting ${meetingId} — total time: ${((Date.now() - pipelineStart) / 1000).toFixed(1)}s`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[pipeline] Pipeline failed for meeting ${meetingId} at step "${step}": ${msg}`);
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
    outputScript = 'roman', isFinal, duration, speakingLanguage,
  } = input;
  console.log(`[pipeline:chunk] Starting chunk for meeting ${meetingId} — file: ${fileName}, size: ${(audioBuffer.byteLength / 1024).toFixed(0)}KB, start: ${chunkStartSeconds}s, isFinal: ${isFinal}`);

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
      const userPrefsNonEnglish = !!speakingLanguage && speakingLanguage !== 'en' && speakingLanguage !== 'en-IN';
      const segIsEnglish = !segScriptLang
        && (detectedLang === 'en-IN' || !detectedLang)
        && !userPrefsNonEnglish;
      const isKnownNonEnglish = !!detectedLang && detectedLang !== 'unknown' && detectedLang !== 'en-IN' && detectedLang !== 'en';
      const segLang = segScriptLang ?? (isKnownNonEnglish ? detectedLang : (userPrefsNonEnglish ? speakingLanguage : detectedLang));
      if (i % 10 === 0) {
        const action = segIsEnglish ? 'english-pass' : outputScript === 'roman' ? 'translit+translate' : 'translate-native';
        console.log(`[pipeline:chunk] Segment ${i + 1}/${dedupedChunk.length} — lang: ${segLang ?? 'null'}, script: ${segScriptLang ?? 'latin'}, action: ${action}`);
      }

      // Find closest A-segment by timestamp (±2s) — shared across branches below
      let aMatch: { sec: number; text: string; dist: number } | null = null;
      for (const a of aIndex) {
        const dist = Math.abs(a.sec - seg.startSeconds);
        if (dist <= 2 && (!aMatch || dist < aMatch.dist)) aMatch = { ...a, dist };
      }

      if (segIsEnglish) {
        // Even when classified English, Pipeline A may have produced a different
        // English translation — that's a signal the source was actually non-English.
        const aText = aMatch ? aMatch.text.trim() : '';
        const ogText = seg.text.trim();
        const differs = aText.length > 0
          && aText.toLowerCase() !== ogText.toLowerCase()
          && Math.abs(aText.length - ogText.length) > 3;
        original = seg.text;
        english = differs ? aMatch!.text : seg.text;
      } else if (outputScript === 'roman') {
        english = aMatch ? aMatch.text : await translateToEnglish(seg.text, segLang);

        const skipTranslit = !segLang || segLang === 'en-IN' || segLang === 'en' || segLang === 'unknown';
        if (skipTranslit) {
          original = seg.text;
        } else {
          try {
            original = await transliterateToRoman(seg.text, segLang);
          } catch (err) {
            console.error('[pipeline:chunk] Transliteration threw — falling back to English:', err instanceof Error ? err.message : err);
            original = english;
          }
          original = await enforceRomanInvariant(seg.text, original, english, segLang);
        }
      } else {
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

    console.log(`[pipeline:chunk] Inserted ${dedupedChunk.length} transcript segments for meeting ${meetingId} (offset: ${indexOffset})`);

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
  console.log(`[pipeline:chunk] Final chunk — generating summary for meeting ${meetingId}`);
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
    console.log(`[pipeline:chunk] Sending transcript-ready email to ${userRow.email}`);
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
