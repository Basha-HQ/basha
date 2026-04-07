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
import { transcribeAudio, translateToEnglish, splitIntoSegments, type DiarizedEntry } from '@/lib/ai/sarvam';
import { generateSummary, generateMeetingTitle } from '@/lib/ai/summarize';
import { sendTranscriptReadyEmail } from '@/lib/email';
import { translateWithLLM } from '@/lib/ai/llm-translate';

/**
 * Normalise Sarvam speaker IDs to zero-padded SPEAKER_XX format so they match
 * the speaker_labels keys stored by /api/extension/session.
 * Handles: "SPEAKER_0" → "SPEAKER_00", "0" → "SPEAKER_00", 0 → "SPEAKER_00"
 */
function normalizeSpeaker(raw: unknown): string | null {
  if (raw == null) return null;
  const s = String(raw).trim();
  if (!s || s === 'null' || s === 'undefined') return null;
  const numOnly = s.match(/^(\d+)$/);
  if (numOnly) return `SPEAKER_${String(parseInt(numOnly[1], 10)).padStart(2, '0')}`;
  const speakerMatch = s.match(/^SPEAKER_?(\d+)$/i);
  if (speakerMatch) return `SPEAKER_${String(parseInt(speakerMatch[1], 10)).padStart(2, '0')}`;
  return s;
}

/**
 * Match Sarvam SPEAKER_XX IDs to real participant names using the RTC active-speaker
 * timeline captured by the Chrome extension content script.
 *
 * The timeline is an array of { name, timestampMs } entries — one per speaker-change
 * event recorded at ~500ms intervals during the meeting via RTCPeerConnection.getStats().
 * recordingStartMs is the meeting's created_at timestamp in milliseconds.
 *
 * For each diarized entry, we look for timeline events that fall within the entry's
 * time window (±1s tolerance) and vote on which name corresponds to each SPEAKER_XX.
 * The name with the most votes wins.
 */
function matchSpeakersToTimeline(
  diarizedEntries: DiarizedEntry[],
  timeline: { name: string; timestampMs: number }[],
  recordingStartMs: number
): Record<string, string> {
  const votes: Record<string, Record<string, number>> = {};

  for (const entry of diarizedEntries) {
    if (!entry.speaker) continue;
    const entryStartMs = recordingStartMs + entry.start * 1000;
    const entryEndMs   = recordingStartMs + entry.end   * 1000;

    const matches = timeline.filter(
      (t) => t.timestampMs >= entryStartMs - 1000 && t.timestampMs <= entryEndMs + 1000
    );

    for (const match of matches) {
      if (!votes[entry.speaker]) votes[entry.speaker] = {};
      votes[entry.speaker][match.name] = (votes[entry.speaker][match.name] ?? 0) + 1;
    }
  }

  const result: Record<string, string> = {};
  for (const [speaker, nameCounts] of Object.entries(votes)) {
    const top = Object.entries(nameCounts).sort((a, b) => b[1] - a[1])[0];
    if (top) result[speaker] = top[0];
  }
  return result;
}

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
    // Use 'translit' mode for Roman output (Romanized text directly from STT),
    // 'transcribe' for native script output
    const sttMode = outputScript === 'roman' ? 'translit' : 'transcribe';
    const sttResult = await transcribeAudio(audioBuffer, fileName, sttMode);

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
    // Priority: explicit sourceLanguage > user's speaking_language profile > STT result.
    // In 'translit' mode Sarvam always returns language_code='en-IN' regardless of actual
    // speech — using it would cause source==target rejection from the translate API.
    // Instead, use the user's speaking_language (e.g. 'ta') if set, or null to trigger
    // Sarvam translate's own auto-detection (omit source_language_code from request).
    const detectedLang: string | null =
      (sourceLanguage && sourceLanguage !== 'auto')
        ? sourceLanguage
        : sttMode === 'translit'
          ? (speakingLanguage && speakingLanguage !== 'auto' ? speakingLanguage : null)
          : (sttResult.language_code && sttResult.language_code !== 'unknown'
              ? sttResult.language_code
              : null);

    // 1b. Match SPEAKER_XX IDs to real names via RTC active-speaker timeline (if available)
    if (sttResult.diarized_entries?.length) {
      const meta = await queryOne<{ active_speaker_timeline: unknown; created_at: string }>(
        'SELECT active_speaker_timeline, created_at FROM meetings WHERE id = $1',
        [meetingId]
      );
      const timeline = Array.isArray(meta?.active_speaker_timeline)
        ? (meta!.active_speaker_timeline as { name: string; timestampMs: number }[])
        : [];

      if (timeline.length > 0) {
        const recordingStartMs = new Date(meta!.created_at).getTime();
        const matched = matchSpeakersToTimeline(sttResult.diarized_entries, timeline, recordingStartMs);
        if (Object.keys(matched).length > 0) {
          await query(
            'UPDATE meetings SET speaker_labels = $1 WHERE id = $2',
            [JSON.stringify(matched), meetingId]
          );
          console.log('[pipeline] Speaker labels from RTC timeline:', matched);
        }
      }
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

    // 3. Translate each segment, then insert transcript rows
    // original_text comes directly from STT (already in the correct script via sttMode)
    const englishSegments: string[] = [];
    for (let i = 0; i < segments.length; i++) {
      const seg = segments[i];
      const originalText = seg.text;
      // english_text: translate to English for AI features + search
      // In translit mode Sarvam outputs Roman-script Indian language text (Tanglish, Hinglish,
      // etc.). Sarvam's translate API is designed for native-script → English and does not work
      // reliably for Roman-script input. Skip it and go straight to the LLM fallback.
      let en: string;
      if (sttMode === 'translit') {
        en = await translateWithLLM(seg.text);
      } else {
        en = await translateToEnglish(seg.text, detectedLang);
      }
      englishSegments.push(en);

      await query(
        `INSERT INTO transcripts
           (meeting_id, segment_index, timestamp_seconds, original_text, english_text, speaker)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [meetingId, i, seg.startSeconds, originalText, en, seg.speaker]
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

  const sttMode = outputScript === 'roman' ? 'translit' : 'transcribe';

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

    // Translate and insert each segment
    for (let i = 0; i < rawSegments.length; i++) {
      const seg = rawSegments[i];
      const en = await translateToEnglish(seg.text, detectedLang);
      await query(
        `INSERT INTO transcripts
           (meeting_id, segment_index, timestamp_seconds, original_text, english_text, speaker)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [meetingId, indexOffset + i, seg.startSeconds, seg.text, en, seg.speaker]
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
