/**
 * Sarvam AI integration for:
 * - Speech-to-text (multilingual, code-mixed) — sync for ≤30s, batch for longer
 * - Translation to English
 */

const SARVAM_BASE_URL = 'https://api.sarvam.ai';
const BATCH_STT_BASE = `${SARVAM_BASE_URL}/speech-to-text/job/v1`;

export interface SarvamSTTResponse {
  transcript: string;
  language_code: string;
  language_probability?: number;
}

export interface SarvamTranslationResponse {
  translated_text: string;
  source_language_code: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function mimeTypeForFile(fileName: string): string {
  const ext = fileName.split('.').pop()?.toLowerCase();
  if (ext === 'mp4') return 'audio/mp4';
  if (ext === 'webm') return 'audio/webm';
  if (ext === 'mp3') return 'audio/mpeg';
  return 'audio/wav';
}

// ── Sync STT (≤30 seconds) ────────────────────────────────────────────────────

async function transcribeAudioSync(
  apiKey: string,
  audioBuffer: Buffer,
  fileName: string
): Promise<SarvamSTTResponse> {
  const formData = new FormData();
  const blob = new Blob([audioBuffer.buffer as ArrayBuffer], { type: mimeTypeForFile(fileName) });
  formData.append('file', blob, fileName);
  formData.append('model', 'saaras:v3');
  formData.append('mode', 'transcribe');

  const response = await fetch(`${SARVAM_BASE_URL}/speech-to-text`, {
    method: 'POST',
    headers: { 'api-subscription-key': apiKey },
    body: formData,
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Sarvam STT failed: ${response.status} ${error}`);
  }

  return response.json();
}

// ── Batch STT (>30 seconds) ───────────────────────────────────────────────────

async function transcribeAudioBatch(
  apiKey: string,
  audioBuffer: Buffer,
  fileName: string
): Promise<SarvamSTTResponse> {
  const headers = { 'api-subscription-key': apiKey, 'Content-Type': 'application/json' };

  // Step 1: Initiate job
  const initRes = await fetch(BATCH_STT_BASE, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      job_parameters: {
        model: 'saaras:v3',
        mode: 'transcribe',
        with_timestamps: false,
        with_diarization: false,
      },
    }),
  });
  if (!initRes.ok) {
    const e = await initRes.text();
    throw new Error(`Sarvam batch init failed: ${initRes.status} ${e}`);
  }
  const { job_id } = (await initRes.json()) as { job_id: string };

  // Step 2: Get presigned upload URL
  const uploadRes = await fetch(`${BATCH_STT_BASE}/upload-files`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ job_id, files: [fileName] }),
  });
  if (!uploadRes.ok) {
    const e = await uploadRes.text();
    throw new Error(`Sarvam batch upload-files failed: ${uploadRes.status} ${e}`);
  }
  const uploadData = (await uploadRes.json()) as {
    upload_urls: Record<string, { file_url: string }>;
    storage_container_type?: string;
  };

  const presignedUrl = uploadData.upload_urls[fileName]?.file_url;
  if (!presignedUrl) throw new Error('No presigned upload URL returned by Sarvam');

  // Step 3: Upload audio to presigned URL
  // Azure Blob Storage presigned URLs require x-ms-blob-type header
  const isAzure =
    presignedUrl.includes('.blob.core.windows.net') ||
    uploadData.storage_container_type?.toLowerCase().includes('azure');
  const putHeaders: Record<string, string> = {
    'Content-Type': mimeTypeForFile(fileName),
  };
  if (isAzure) {
    putHeaders['x-ms-blob-type'] = 'BlockBlob';
  }
  const putRes = await fetch(presignedUrl, {
    method: 'PUT',
    headers: putHeaders,
    body: new Uint8Array(audioBuffer),
  });
  if (!putRes.ok) {
    const errBody = await putRes.text();
    throw new Error(`Sarvam presigned upload failed: ${putRes.status} ${errBody}`);
  }

  // Step 4: Start the job
  const startRes = await fetch(`${BATCH_STT_BASE}/${job_id}/start`, {
    method: 'POST',
    headers: { 'api-subscription-key': apiKey },
  });
  if (!startRes.ok) {
    const e = await startRes.text();
    throw new Error(`Sarvam batch start failed: ${startRes.status} ${e}`);
  }

  // Step 5: Poll until Completed (max 10 min)
  // Status response includes task-level details with output file names
  type JobDetail = {
    inputs: Array<{ file_name: string; file_id: string }>;
    outputs: Array<{ file_name: string; file_id: string }>;
    state: string;
  };
  type StatusResponse = {
    job_state: string;
    job_details?: JobDetail[];
  };
  let completedStatus: StatusResponse | null = null;
  const pollDeadline = Date.now() + 10 * 60 * 1000;
  while (Date.now() < pollDeadline) {
    await new Promise((r) => setTimeout(r, 5000));

    const statusRes = await fetch(`${BATCH_STT_BASE}/${job_id}/status`, {
      headers: { 'api-subscription-key': apiKey },
    });
    if (!statusRes.ok) continue;

    const statusData = (await statusRes.json()) as StatusResponse;
    if (statusData.job_state === 'Completed') {
      completedStatus = statusData;
      break;
    }
    if (statusData.job_state === 'Failed') {
      throw new Error('Sarvam batch job failed');
    }
  }
  if (!completedStatus) throw new Error('Sarvam batch job timed out');

  // Extract output file name from job_details (e.g. "0.json")
  const outputFileName = completedStatus.job_details?.[0]?.outputs?.[0]?.file_name;
  if (!outputFileName) throw new Error('No output file name in Sarvam batch status');

  // Step 6: Get download URL for the output file
  const downloadRes = await fetch(`${BATCH_STT_BASE}/download-files`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ job_id, files: [outputFileName] }),
  });
  if (!downloadRes.ok) {
    const e = await downloadRes.text();
    throw new Error(`Sarvam batch download-files failed: ${downloadRes.status} ${e}`);
  }
  const downloadData = (await downloadRes.json()) as {
    download_urls: Record<string, { file_url: string }>;
  };

  const resultUrl =
    downloadData.download_urls[outputFileName]?.file_url ??
    Object.values(downloadData.download_urls)[0]?.file_url;
  if (!resultUrl) throw new Error('No download URL returned by Sarvam batch API');

  const resultRes = await fetch(resultUrl);
  if (!resultRes.ok) throw new Error(`Failed to download Sarvam batch result: ${resultRes.status}`);
  const result = (await resultRes.json()) as {
    transcript?: string;
    language_code?: string;
    // batch result may be an array of segments
    results?: Array<{ transcript: string; language_code?: string }>;
  };

  // Normalise: batch result can be { transcript } or { results: [{transcript}] }
  const transcript =
    result.transcript ??
    result.results?.map((r) => r.transcript).join(' ') ??
    '';
  const language_code =
    result.language_code ?? result.results?.[0]?.language_code ?? 'unknown';

  return { transcript, language_code };
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Transcribe audio using Sarvam AI.
 * Uses batch API for compressed formats (mp4/webm) since duration can't be reliably
 * inferred from file size. Falls back to sync for short WAV files (≤500 KB).
 */
export async function transcribeAudio(
  audioBuffer: Buffer,
  fileName: string
): Promise<SarvamSTTResponse> {
  const apiKey = process.env.SARVAM_API_KEY;
  if (!apiKey) throw new Error('SARVAM_API_KEY is not set');

  const ext = fileName.split('.').pop()?.toLowerCase();
  // Compressed formats (mp4/webm) can be >30s even at small file sizes — always use batch
  const alwaysBatch = ext === 'mp4' || ext === 'webm';
  // For WAV: 500 KB ≈ ~15s of mono 16kHz PCM — safe threshold for sync
  const WAV_SYNC_LIMIT = 500_000;

  if (alwaysBatch || audioBuffer.byteLength > WAV_SYNC_LIMIT) {
    return transcribeAudioBatch(apiKey, audioBuffer, fileName);
  }
  return transcribeAudioSync(apiKey, audioBuffer, fileName);
}

/**
 * Translate a text segment to English using Sarvam AI.
 */
export async function translateToEnglish(
  text: string,
  sourceLanguage: string = 'auto'
): Promise<string> {
  const apiKey = process.env.SARVAM_API_KEY;
  if (!apiKey) throw new Error('SARVAM_API_KEY is not set');

  const languageMap: Record<string, string> = {
    ta: 'ta-IN',
    hi: 'hi-IN',
    te: 'te-IN',
    kn: 'kn-IN',
    en: 'en-IN',
    auto: 'auto',
  };

  const sourceLang = languageMap[sourceLanguage] ?? 'auto';

  const response = await fetch(`${SARVAM_BASE_URL}/translate`, {
    method: 'POST',
    headers: {
      'api-subscription-key': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      input: text,
      source_language_code: sourceLang,
      target_language_code: 'en-IN',
      model: 'mayura:v1',
      mode: 'formal',
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Sarvam translation failed: ${response.status} ${error}`);
  }

  const data: SarvamTranslationResponse = await response.json();
  return data.translated_text;
}

/**
 * Split a full transcript into segments for processing.
 * saaras:v3 returns a single transcript string; this splits it by sentence.
 */
export function splitIntoSegments(
  transcript: string,
  durationSeconds: number
): Array<{ text: string; startSeconds: number }> {
  const sentences = transcript
    .split(/(?<=[.!?।])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);

  const segmentDuration = durationSeconds / Math.max(sentences.length, 1);

  return sentences.map((text, i) => ({
    text,
    startSeconds: Math.round(i * segmentDuration),
  }));
}
