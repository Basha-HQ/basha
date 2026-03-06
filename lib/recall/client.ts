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
  const key = process.env.RECALL_API_KEY;
  if (!key) throw new Error('RECALL_API_KEY is not set');
  return {
    Authorization: `Token ${key}`,
    'Content-Type': 'application/json',
  };
}

// ── API Methods ───────────────────────────────────────────────────────────────

/** Create a bot that joins the given meeting URL. */
export async function createBot(
  meetingUrl: string,
  botName = 'LinguaMeet Bot'
): Promise<RecallBot> {
  const res = await fetch(`${getBase()}/bot`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({
      meeting_url: meetingUrl,
      bot_name: botName,
    }),
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

// ── Status helpers ────────────────────────────────────────────────────────────

/** Get the latest status code from a Recall.ai bot response. */
export function getLatestStatus(bot: RecallBot): string {
  const changes = bot.status_changes ?? [];
  return changes.length > 0 ? changes[changes.length - 1].code : 'unknown';
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
