/**
 * Recall.ai API client.
 *
 * Docs: https://docs.recall.ai/docs/quickstart
 *
 * Recall.ai manages meeting bots that join Google Meet / Zoom / Teams calls,
 * record audio+video, and provide download URLs when the meeting ends.
 * We only need the audio — which we feed into our Sarvam AI pipeline.
 */

// ── Types ─────────────────────────────────────────────────────────────────────

export interface RecallStatusChange {
  code: string;
  message: string | null;
  created_at: string;
}

export interface RecallRecording {
  id: string;
  media_shortcuts: {
    video_mixed?: { data?: { download_url?: string } };
    audio_mixed?: { data?: { download_url?: string } };
    transcript?: { data?: { download_url?: string } };
  };
}

export interface RecallTranscriptSegment {
  speaker: string;
  start_time: number;
  end_time: number;
}

/**
 * One participant returned by GET /bot/{id}/meeting_participants/.
 * `events` lists every active_speaker / join / leave action with timestamps;
 * we use the speaking windows derived from this to map names to timestamps.
 */
export interface RecallMeetingParticipant {
  id: number;
  name: string;
  is_host?: boolean;
  events: Array<{
    action: string;
    created_at: string;
    // For active_speaker events: { value: true } means speaking started, false ended
    value?: unknown;
  }>;
}

/**
 * Speaking window derived from a participant's active_speaker events,
 * expressed as seconds offset from bot.join_at (recording start).
 */
export interface SpeakingWindow {
  name: string;
  start_seconds: number;
  end_seconds: number;
}

export interface RecallBot {
  id: string;
  meeting_url: string;
  bot_name: string;
  status_changes: RecallStatusChange[];
  recordings: RecallRecording[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function getBase() {
  const region = process.env.RECALL_REGION;
  if (!region) throw new Error('RECALL_REGION is not set');
  return `https://${region}.recall.ai/api/v1`;
}

function getHeaders() {
  const key = process.env.RECALL_AI_API_KEY;
  if (!key) throw new Error('RECALL_AI_API_KEY is not set');
  return {
    Authorization: `Token ${key}`,
    'Content-Type': 'application/json',
  };
}

// ── API Methods ───────────────────────────────────────────────────────────────

/** Create a bot that joins the given meeting URL. */
export async function createBot(
  meetingUrl: string,
  botName = 'Basha Bot',
  webhookUrl?: string
): Promise<RecallBot> {
  // recording_config tells Recall.ai to:
  //  - capture an audio recording (audio_mixed) — needed for Sarvam STT
  //  - run its built-in transcription (meeting_captions provider) — gives us
  //    real participant names + timestamps used to auto-name speakers in our
  //    transcript without any user interaction
  //  - emit participant_events — backup signal for "who was active speaker"
  const body: Record<string, unknown> = {
    meeting_url: meetingUrl,
    bot_name: botName,
    recording_config: {
      audio_mixed_raw: {},
      transcript: {
        provider: {
          meeting_captions: {},
        },
      },
      participant_events: {},
    },
    // Leave automatically 5 seconds after all human participants have gone
    automatic_leave: {
      everyone_left_timeout: 5,
    },
  };
  // Stream a branded overlay as the bot's camera feed.
  // Recall.ai renders the URL in headless Chromium — only works when publicly reachable.
  const appUrl = process.env.NEXTAUTH_URL ?? '';
  if (appUrl.startsWith('https://')) {
    body.output_media = {
      camera: {
        kind: 'webpage',
        config: {
          url: `${appUrl}/bot-overlay`,
          width: 1280,
          height: 720,
        },
      },
    };
  }
  if (webhookUrl) {
    body.webhook_url = webhookUrl;
  }
  const res = await fetch(`${getBase()}/bot`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Recall.ai createBot failed: ${res.status} ${text}`);
  }

  return res.json();
}

/** Get current bot state (status, recordings). */
export async function getBot(recallBotId: string): Promise<RecallBot> {
  const res = await fetch(`${getBase()}/bot/${recallBotId}`, {
    method: 'GET',
    headers: getHeaders(),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Recall.ai getBot failed: ${res.status} ${text}`);
  }

  return res.json();
}

/** Remove a bot from the meeting (stop recording). */
export async function deleteBot(recallBotId: string): Promise<void> {
  const res = await fetch(`${getBase()}/bot/${recallBotId}`, {
    method: 'DELETE',
    headers: getHeaders(),
  });

  // 204 No Content is success, 404 means already gone — both fine
  if (!res.ok && res.status !== 404) {
    const text = await res.text();
    throw new Error(`Recall.ai deleteBot failed: ${res.status} ${text}`);
  }
}

/**
 * Download and parse a Recall.ai transcript from a signed URL.
 * Returns an array of segments with real participant names and timestamps.
 * Returns [] on any error so callers can safely skip naming.
 *
 * Recall.ai transcript format (words-level):
 *   [ { speaker: "Name", words: [{text, start_time, end_time, ...}] }, ... ]
 * We flatten each word entry into a segment span keyed by speaker.
 */
export async function fetchRecallTranscript(url: string): Promise<RecallTranscriptSegment[]> {
  try {
    const res = await fetch(url);
    if (!res.ok) return [];

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const raw: any[] = await res.json();
    if (!Array.isArray(raw)) return [];

    const segments: RecallTranscriptSegment[] = [];

    for (const entry of raw) {
      const speaker: string = entry?.speaker ?? entry?.participant?.name ?? '';
      if (!speaker) continue;

      // Each entry has either `words` array (word-level) or direct start/end
      if (Array.isArray(entry.words) && entry.words.length > 0) {
        const start = entry.words[0]?.start_time ?? entry.words[0]?.offset?.start ?? 0;
        const end = entry.words[entry.words.length - 1]?.end_time ?? entry.words[entry.words.length - 1]?.offset?.end ?? start;
        segments.push({ speaker, start_time: Number(start), end_time: Number(end) });
      } else if (entry.start_time != null && entry.end_time != null) {
        segments.push({ speaker, start_time: Number(entry.start_time), end_time: Number(entry.end_time) });
      }
    }

    return segments;
  } catch {
    return [];
  }
}

/**
 * Fetch all meeting participants for a bot, including their event timeline.
 * Returns [] on any error so callers can fall back gracefully.
 */
export async function fetchMeetingParticipants(recallBotId: string): Promise<RecallMeetingParticipant[]> {
  try {
    const res = await fetch(`${getBase()}/bot/${recallBotId}/meeting_participants/`, {
      method: 'GET',
      headers: getHeaders(),
    });
    if (!res.ok) return [];
    const json = await res.json();
    // API may return either { results: [...] } or a raw array
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const list: any[] = Array.isArray(json) ? json : json.results ?? [];
    return list.map((p) => ({
      id: p.id,
      name: p.name ?? '',
      is_host: p.is_host,
      events: Array.isArray(p.events) ? p.events : [],
    })).filter((p) => p.name);
  } catch {
    return [];
  }
}

/**
 * Convert a participant's `active_speaker` event stream into speaking windows
 * relative to the recording start (`recordingStartIso`).
 *
 * Recall.ai emits paired events: `{action:"active_speaker", value:true}` when
 * someone starts speaking, and `{value:false}` (or another start) when they stop.
 */
export function deriveSpeakingWindows(
  participants: RecallMeetingParticipant[],
  recordingStartIso: string
): SpeakingWindow[] {
  const startMs = new Date(recordingStartIso).getTime();
  if (!Number.isFinite(startMs)) return [];

  const windows: SpeakingWindow[] = [];
  for (const p of participants) {
    let openStart: number | null = null;
    for (const ev of p.events) {
      if (ev.action !== 'active_speaker') continue;
      const t = (new Date(ev.created_at).getTime() - startMs) / 1000;
      if (!Number.isFinite(t)) continue;

      if (ev.value === true || ev.value === 'true') {
        if (openStart === null) openStart = t;
      } else if (ev.value === false || ev.value === 'false') {
        if (openStart !== null) {
          windows.push({ name: p.name, start_seconds: openStart, end_seconds: t });
          openStart = null;
        }
      }
    }
    // If a window never closed (recording ended while speaking), close it loosely
    if (openStart !== null) {
      windows.push({ name: p.name, start_seconds: openStart, end_seconds: openStart + 60 });
    }
  }
  return windows;
}

// ── Status helpers ────────────────────────────────────────────────────────────

/** Get the latest status code from a Recall.ai bot response. */
export function getLatestStatus(bot: RecallBot): string {
  const changes = bot.status_changes ?? [];
  return changes.length > 0 ? changes[changes.length - 1].code : 'unknown';
}

/**
 * Find when the bot started recording — the ISO timestamp of the first
 * `in_call_recording` status change. Returns null if recording never started.
 * Used to convert absolute participant event timestamps into seconds-from-start.
 */
export function getRecordingStartIso(bot: RecallBot): string | null {
  const first = (bot.status_changes ?? []).find((c) => c.code === 'in_call_recording');
  return first?.created_at ?? null;
}

/**
 * Map Recall.ai status codes to our internal BotStatus.
 *
 * Recall.ai statuses (from docs):
 *   ready, joining_call, in_waiting_room,
 *   in_call_not_recording, in_call_recording,
 *   call_ended, done, fatal, analysis_failed
 */
export function mapRecallStatus(recallStatus: string): string {
  switch (recallStatus) {
    case 'ready':
    case 'joining_call':
    case 'in_waiting_room':
      return 'joining';
    case 'in_call_not_recording':
      return 'in_meeting';
    case 'in_call_recording':
      return 'recording';
    case 'call_ended':
      return 'leaving';
    case 'done':
      return 'done'; // special — triggers audio download + processing
    case 'fatal':
    case 'analysis_failed':
      return 'failed';
    default:
      return 'joining'; // fallback for unknown statuses
  }
}

/**
 * Extract the best audio/video download URL from a Recall.ai bot.
 * Prefers audio_mixed, falls back to video_mixed.
 */
export function getRecordingUrl(bot: RecallBot): string | null {
  const rec = bot.recordings?.[0];
  if (!rec) return null;
  return (
    rec.media_shortcuts?.audio_mixed?.data?.download_url ??
    rec.media_shortcuts?.video_mixed?.data?.download_url ??
    null
  );
}
