/**
 * Shared speaker-label resolution logic.
 *
 * Given a meeting and the actual Sarvam speaker IDs that appeared in its
 * transcript, resolve each SPEAKER_XX to a real person's name using three
 * fallback strategies:
 *
 *   (a) RTC active-speaker timeline voting — Google Meet / Teams, when the
 *       Chrome extension's injected RTC hook captured who was loud and when.
 *   (b) Positional remap of the participant names that /api/extension/session
 *       pre-seeded into speaker_labels. The session route keys names as
 *       SPEAKER_00, SPEAKER_01, ... in scrape order, but Sarvam's diarized IDs
 *       may not start at 00 or may appear in a different order — so we remap
 *       the seeded names onto the actual Sarvam IDs in order of first utterance.
 *   (c) Solo-speaker fallback: when Sarvam detects exactly one speaker and we
 *       have no usable participant names, use the meeting owner's profile name.
 *
 * Used by:
 *   - lib/recording/pipeline.ts (new recordings, after STT)
 *   - app/(dashboard)/meetings/[id]/page.tsx (lazy self-heal for old meetings)
 */

import { query, queryOne } from '@/lib/db';
import type { DiarizedEntry } from '@/lib/ai/sarvam';

/**
 * Normalise Sarvam speaker IDs to zero-padded SPEAKER_XX format so they match
 * the speaker_labels keys stored by /api/extension/session.
 * Handles: "SPEAKER_0" → "SPEAKER_00", "0" → "SPEAKER_00", 0 → "SPEAKER_00"
 */
export function normalizeSpeaker(raw: unknown): string | null {
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
 * Compact time-window entry used for timeline voting. This is the subset of
 * DiarizedEntry we actually need, and can also be synthesised from transcript
 * rows (start only — we derive end as the next segment's start).
 */
export interface SpeakerWindow {
  speaker: string;       // normalised SPEAKER_XX
  startSec: number;
  endSec: number;
}

/**
 * Match Sarvam SPEAKER_XX IDs to real participant names using the RTC
 * active-speaker timeline captured by the Chrome extension content script.
 *
 * The timeline is an array of { name, timestampMs } entries — one per
 * speaker-change event recorded during the meeting via RTCPeerConnection.getStats().
 * For each window we tally which timeline names fall inside it (±1s tolerance)
 * and the name with the most votes wins for that speaker ID.
 */
export function matchSpeakersToTimeline(
  windows: SpeakerWindow[],
  timeline: { name: string; timestampMs: number }[],
  recordingStartMs: number
): Record<string, string> {
  const votes: Record<string, Record<string, number>> = {};

  for (const w of windows) {
    if (!w.speaker) continue;
    const startMs = recordingStartMs + w.startSec * 1000;
    const endMs   = recordingStartMs + w.endSec   * 1000;

    const matches = timeline.filter(
      (t) => t.timestampMs >= startMs - 1000 && t.timestampMs <= endMs + 1000
    );

    for (const m of matches) {
      if (!votes[w.speaker]) votes[w.speaker] = {};
      votes[w.speaker][m.name] = (votes[w.speaker][m.name] ?? 0) + 1;
    }
  }

  const result: Record<string, string> = {};
  for (const [speaker, nameCounts] of Object.entries(votes)) {
    const top = Object.entries(nameCounts).sort((a, b) => b[1] - a[1])[0];
    if (top) result[speaker] = top[0];
  }
  return result;
}

/**
 * Extract the unique Sarvam speaker IDs from diarized entries in order of
 * first utterance.
 */
export function actualSpeakerIdsFromDiarized(entries: DiarizedEntry[]): string[] {
  const ids: string[] = [];
  const seen = new Set<string>();
  for (const e of entries) {
    const raw = e as unknown as Record<string, unknown>;
    const id = normalizeSpeaker(e.speaker ?? raw['speaker_id']);
    if (id && !seen.has(id)) {
      seen.add(id);
      ids.push(id);
    }
  }
  return ids;
}

/**
 * Convert DiarizedEntry[] into SpeakerWindow[] (normalising speaker IDs and
 * coercing start/end into seconds).
 */
export function windowsFromDiarized(entries: DiarizedEntry[]): SpeakerWindow[] {
  return entries
    .map((e) => {
      const raw = e as unknown as Record<string, unknown>;
      const speaker = normalizeSpeaker(e.speaker ?? raw['speaker_id']);
      if (!speaker) return null;
      const start = typeof e.start === 'number' ? e.start : 0;
      const end   = typeof e.end   === 'number' ? e.end   : start;
      return { speaker, startSec: start, endSec: end };
    })
    .filter((w): w is SpeakerWindow => w !== null);
}

/**
 * Resolve speaker labels for a meeting and persist them if they changed.
 *
 * Returns the resolved labels (or null if nothing could be determined).
 *
 * @param meetingId           The meeting to update
 * @param actualSpeakerIds    Unique SPEAKER_XX IDs from the transcript, in order of first utterance
 * @param windows             Optional time windows for RTC timeline voting (tier a).
 *                            When omitted, tier (a) is skipped — that's fine for the lazy
 *                            self-heal path where we only have transcript rows.
 */
export async function resolveAndPersistSpeakerLabels(
  meetingId: string,
  actualSpeakerIds: string[],
  windows?: SpeakerWindow[]
): Promise<Record<string, string> | null> {
  if (actualSpeakerIds.length === 0) return null;

  const meta = await queryOne<{
    active_speaker_timeline: unknown;
    speaker_labels: unknown;
    created_at: string;
    owner_name: string | null;
  }>(
    `SELECT m.active_speaker_timeline, m.speaker_labels, m.created_at, u.name AS owner_name
     FROM meetings m
     JOIN users u ON u.id = m.user_id
     WHERE m.id = $1`,
    [meetingId]
  );
  if (!meta) return null;

  const timeline = Array.isArray(meta.active_speaker_timeline)
    ? (meta.active_speaker_timeline as { name: string; timestampMs: number }[])
    : [];

  let resolved: Record<string, string> | null = null;

  // (a) Timeline voting — only possible when we have windows AND a timeline.
  if (windows && windows.length > 0 && timeline.length > 0) {
    const recordingStartMs = new Date(meta.created_at).getTime();
    const matched = matchSpeakersToTimeline(windows, timeline, recordingStartMs);
    if (Object.keys(matched).length > 0) {
      resolved = matched;
      console.log('[speakerLabels] From RTC timeline:', matched);
    }
  }

  // (b) Positional remap of pre-seeded labels
  if (!resolved) {
    const seeded =
      meta.speaker_labels && typeof meta.speaker_labels === 'object'
        ? (meta.speaker_labels as Record<string, string>)
        : null;
    if (seeded) {
      const seededKeys = Object.keys(seeded);
      const isPositional = seededKeys.every((k) => /^SPEAKER_\d+$/.test(k));
      const keyMismatch = !seededKeys.some((k) => actualSpeakerIds.includes(k));
      if (isPositional && keyMismatch && seededKeys.length > 0) {
        const orderedNames = seededKeys.sort().map((k) => seeded[k]).filter(Boolean);
        const remapped: Record<string, string> = {};
        actualSpeakerIds.forEach((id, i) => {
          if (orderedNames[i]) remapped[id] = orderedNames[i];
        });
        if (Object.keys(remapped).length > 0) {
          resolved = remapped;
          console.log('[speakerLabels] Remapped positional labels to actual Sarvam IDs:', remapped);
        }
      } else if (!isPositional || !keyMismatch) {
        // Already valid — keep as-is (e.g. user manually renamed them, or timeline already set them).
        resolved = seeded;
      }
    }
  }

  // (c) Solo-speaker fallback → meeting owner's profile name
  if (!resolved && actualSpeakerIds.length === 1 && meta.owner_name) {
    resolved = { [actualSpeakerIds[0]]: meta.owner_name };
    console.log('[speakerLabels] Solo-speaker fallback — using owner name:', resolved);
  }

  if (resolved && Object.keys(resolved).length > 0) {
    // Only persist if something actually changed — avoids redundant writes on every page load.
    const current = meta.speaker_labels && typeof meta.speaker_labels === 'object'
      ? (meta.speaker_labels as Record<string, string>)
      : {};
    const currentJson = JSON.stringify(current, Object.keys(current).sort());
    const resolvedJson = JSON.stringify(resolved, Object.keys(resolved).sort());
    if (currentJson !== resolvedJson) {
      await query(
        'UPDATE meetings SET speaker_labels = $1 WHERE id = $2',
        [JSON.stringify(resolved), meetingId]
      );
    }
  }

  return resolved;
}

/**
 * Lazy self-heal entry point for existing meetings.
 *
 * Reads the transcript rows from the DB (to discover actual Sarvam speaker IDs),
 * then runs resolveAndPersistSpeakerLabels. Designed to be called idempotently
 * from a server component on page load.
 *
 * Returns the resolved labels (possibly unchanged) or null if there are no
 * speaker-bearing transcripts yet.
 */
export async function resolveSpeakerLabelsFromTranscripts(
  meetingId: string
): Promise<Record<string, string> | null> {
  const rows = await query<{ speaker: string | null; timestamp_seconds: number | null }>(
    `SELECT speaker, timestamp_seconds
     FROM transcripts
     WHERE meeting_id = $1 AND speaker IS NOT NULL
     ORDER BY segment_index`,
    [meetingId]
  );
  if (rows.length === 0) return null;

  // Unique speaker IDs in order of first appearance
  const actualSpeakerIds: string[] = [];
  const seen = new Set<string>();
  for (const r of rows) {
    const id = r.speaker ? normalizeSpeaker(r.speaker) : null;
    if (id && !seen.has(id)) {
      seen.add(id);
      actualSpeakerIds.push(id);
    }
  }

  // Build approximate windows — end of segment ≈ start of next segment.
  // Good enough for timeline voting at ±1s tolerance.
  const windows: SpeakerWindow[] = [];
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const id = r.speaker ? normalizeSpeaker(r.speaker) : null;
    if (!id) continue;
    const start = r.timestamp_seconds ?? 0;
    const nextStart = rows[i + 1]?.timestamp_seconds ?? start + 5;
    windows.push({ speaker: id, startSec: start, endSec: nextStart });
  }

  return resolveAndPersistSpeakerLabels(meetingId, actualSpeakerIds, windows);
}
