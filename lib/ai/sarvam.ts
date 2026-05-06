/**
 * Sarvam AI integration for:
 * - Speech-to-text (multilingual, code-mixed) — sync for ≤30s, batch for longer
 * - Translation to English
 */

const SARVAM_BASE_URL = 'https://api.sarvam.ai';
const BATCH_STT_BASE = `${SARVAM_BASE_URL}/speech-to-text/job/v1`;

export interface DiarizedEntry {
  speaker: string;    // e.g. "SPEAKER_00", "SPEAKER_01"
  transcript: string;
  start: number;      // seconds from meeting start
  end: number;
}

export interface SarvamSTTResponse {
  transcript: string;
  language_code: string;
  language_probability?: number;
  diarized_entries?: DiarizedEntry[];
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
  fileName: string,
  sttMode: string = 'transcribe',
  languageCode?: string
): Promise<SarvamSTTResponse> {
  const formData = new FormData();
  const blob = new Blob([audioBuffer.buffer as ArrayBuffer], { type: mimeTypeForFile(fileName) });
  formData.append('file', blob, fileName);
  formData.append('model', 'saaras:v3');
  formData.append('mode', sttMode);
  if (languageCode) formData.append('language_code', languageCode);
  // NOTE: Sarvam's real-time (sync) API does NOT support with_diarization.
  // Diarization is only available via the batch API (transcribeAudioBatch).

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
  fileName: string,
  sttMode: string = 'transcribe',
  languageCode?: string
): Promise<SarvamSTTResponse> {
  const headers = { 'api-subscription-key': apiKey, 'Content-Type': 'application/json' };

  // Step 1: Initiate job
  const initRes = await fetch(BATCH_STT_BASE, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      job_parameters: {
        model: 'saaras:v3',
        mode: sttMode,
        with_timestamps: true,
        with_diarization: true,
        ...(languageCode ? { language_code: languageCode } : {}),
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
    error_message?: string;
  };
  type StatusResponse = {
    job_state: string;
    job_details?: JobDetail[];
    failed_files_count?: number;
    total_files?: number;
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

  // Log the full status so we can debug output file name issues
  console.log('[sarvam] Batch job completed. Full status:', JSON.stringify(completedStatus, null, 2));

  // Check if the job actually succeeded — Sarvam reports "Completed" even when all files failed
  const jobDetail = completedStatus.job_details?.[0];
  if (jobDetail?.state === 'API Error' || completedStatus.failed_files_count === completedStatus.total_files) {
    const detailMsg = jobDetail?.error_message || 'Unknown batch processing error';
    throw new Error(`Sarvam batch STT failed: ${detailMsg}`);
  }

  // Extract output file name from job_details
  // Sarvam may return outputs in job_details or the output may use the input file name
  const outputFileName = completedStatus.job_details?.[0]?.outputs?.[0]?.file_name;

  // Step 6: Get download URL for the output file
  // Try multiple candidate file names — Sarvam's API is inconsistent about naming
  const candidateFiles = [
    outputFileName,
    fileName.replace(/\.[^.]+$/, '.json'),  // e.g. "uuid.webm" → "uuid.json"
    fileName,                                // original file name
    '0.json',                                // fallback index-based name
  ].filter((f): f is string => !!f);

  let downloadData: { download_urls: Record<string, { file_url: string }> } | null = null;

  for (const candidate of candidateFiles) {
    const downloadRes = await fetch(`${BATCH_STT_BASE}/download-files`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ job_id, files: [candidate] }),
    });
    if (downloadRes.ok) {
      downloadData = await downloadRes.json();
      console.log(`[sarvam] Download succeeded with file name: "${candidate}"`);
      break;
    }
    console.log(`[sarvam] Download attempt with "${candidate}" failed: ${downloadRes.status}`);
  }

  if (!downloadData) {
    throw new Error(`Sarvam batch download-files failed for all candidates: ${candidateFiles.join(', ')}`);
  }

  const resultUrl = Object.values(downloadData.download_urls)[0]?.file_url;
  if (!resultUrl) throw new Error('No download URL returned by Sarvam batch API');

  const resultRes = await fetch(resultUrl);
  if (!resultRes.ok) throw new Error(`Failed to download Sarvam batch result: ${resultRes.status}`);
  const result = (await resultRes.json()) as {
    transcript?: string;
    language_code?: string;
    // results[] may include per-chunk timing when with_timestamps: true
    results?: Array<{ transcript: string; language_code?: string; start?: number; end?: number }>;
    // Diarized output — Sarvam may return { entries: [] } or a flat array
    diarized_transcript?: { entries?: DiarizedEntry[] } | DiarizedEntry[];
    diarized_content?: { entries?: DiarizedEntry[] } | DiarizedEntry[];
  };

  // Normalise: batch result can be { transcript } or { results: [{transcript}] }
  const transcript =
    result.transcript ??
    result.results?.map((r) => r.transcript).join(' ') ??
    '';
  const language_code =
    result.language_code ?? result.results?.[0]?.language_code ?? 'unknown';

  // Extract diarized entries — handle both { entries: [] } and flat array shapes
  const rawDiarized = result.diarized_transcript ?? result.diarized_content;
  const diarized_entries: DiarizedEntry[] = Array.isArray(rawDiarized)
    ? rawDiarized
    : (rawDiarized as { entries?: DiarizedEntry[] } | undefined)?.entries ?? [];

  return { transcript, language_code, diarized_entries };
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Transcribe audio using Sarvam AI.
 * Strategy: always try sync API first (handles WebM/Opus natively via multipart).
 * If sync fails with a duration/size error (>30s limit), fall back to batch API.
 * The batch API uploads to Azure Blob Storage which may not support all formats,
 * so sync is preferred.
 */
export async function transcribeAudio(
  audioBuffer: Buffer,
  fileName: string,
  sttMode: string = 'transcribe',
  languageCode?: string
): Promise<SarvamSTTResponse> {
  const apiKey = process.env.SARVAM_AI_API_KEY;
  if (!apiKey) throw new Error('SARVAM_AI_API_KEY is not set');

  // Try sync API first — it handles WebM/Opus natively via multipart upload
  try {
    console.log(`[sarvam] Trying sync STT for ${fileName} (${(audioBuffer.byteLength / 1024).toFixed(0)} KB) mode=${sttMode} lang=${languageCode ?? 'auto'}`);
    return await transcribeAudioSync(apiKey, audioBuffer, fileName, sttMode, languageCode);
  } catch (syncErr) {
    const msg = syncErr instanceof Error ? syncErr.message : String(syncErr);
    // If sync fails due to duration limit, fall back to batch
    if (msg.includes('duration') || msg.includes('too long') || msg.includes('413') || msg.includes('file size')) {
      console.log(`[sarvam] Sync STT rejected (likely >30s), falling back to batch: ${msg}`);
      return transcribeAudioBatch(apiKey, audioBuffer, fileName, sttMode, languageCode);
    }
    // Any other sync error — re-throw
    throw syncErr;
  }
}

/**
 * Translate a text segment to English using Sarvam AI.
 */
export async function translateToEnglish(
  text: string,
  sourceLanguage: string | null = null
): Promise<string> {
  const apiKey = process.env.SARVAM_AI_API_KEY;
  if (!apiKey) throw new Error('SARVAM_AI_API_KEY is not set');

  // Map bare ISO codes → Sarvam locale codes. Full locale codes pass through unchanged.
  const languageMap: Record<string, string> = {
    ta: 'ta-IN',
    hi: 'hi-IN',
    te: 'te-IN',
    kn: 'kn-IN',
    ml: 'ml-IN',
    mr: 'mr-IN',
    bn: 'bn-IN',
    gu: 'gu-IN',
    pa: 'pa-IN',
    or: 'or-IN',
    en: 'en-IN',
    auto: 'auto',
    unknown: 'auto',
  };

  const sourceLang = sourceLanguage ? (languageMap[sourceLanguage] ?? sourceLanguage) : null;

  // Sarvam translate requires source_language_code — it cannot be omitted.
  // If we don't know the language (translit mode with no user preference set),
  // return the original text rather than making a doomed API call.
  if (!sourceLang || sourceLang === 'auto') {
    console.warn(`[sarvam] Translation skipped (source language unknown — set speaking_language in profile): "${text.slice(0, 60)}"`);
    return text;
  }

  const requestBody: Record<string, string> = {
    input: text,
    source_language_code: sourceLang,
    target_language_code: 'en-IN',
    model: 'mayura:v1',
    mode: 'formal',
  };

  const response = await fetch(`${SARVAM_BASE_URL}/translate`, {
    method: 'POST',
    headers: {
      'api-subscription-key': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const error = await response.text();
    // 422 = Sarvam can't detect language — return original text rather than
    // crashing the pipeline. The transcript is still useful as-is.
    if (response.status === 422) {
      console.warn(`[sarvam] Translation skipped (language undetectable, source="${sourceLanguage}"): returning original text`);
      return text;
    }
    // 400 with "must be different" = source already is the target language
    if (response.status === 400 && error.includes('must be different')) {
      console.warn(`[sarvam] Translation skipped (source == target, source="${sourceLanguage}"): returning original text`);
      return text;
    }
    throw new Error(`Sarvam translation failed: ${response.status} ${error}`);
  }

  const data: SarvamTranslationResponse = await response.json();
  return data.translated_text;
}

/**
 * Transliterate native-script Indian language text to Roman script using Sarvam AI.
 * Uses the /translate endpoint with same source and target language + output_script: 'roman'.
 */
export async function transliterateToRoman(
  text: string,
  sourceLanguage: string | null
): Promise<string> {
  const apiKey = process.env.SARVAM_AI_API_KEY;
  if (!apiKey) throw new Error('SARVAM_AI_API_KEY is not set');

  const languageMap: Record<string, string> = {
    ta: 'ta-IN',
    hi: 'hi-IN',
    te: 'te-IN',
    kn: 'kn-IN',
    ml: 'ml-IN',
    mr: 'mr-IN',
    bn: 'bn-IN',
    gu: 'gu-IN',
    pa: 'pa-IN',
    or: 'or-IN',
    en: 'en-IN',
    auto: 'auto',
    unknown: 'auto',
  };

  const lang = sourceLanguage ? (languageMap[sourceLanguage] ?? sourceLanguage) : null;

  if (!lang || lang === 'auto') {
    console.warn('[sarvam] Transliteration skipped (unknown source language): returning original');
    return text;
  }

  const response = await fetch(`${SARVAM_BASE_URL}/translate`, {
    method: 'POST',
    headers: {
      'api-subscription-key': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      input: text,
      source_language_code: lang,
      target_language_code: lang,  // same language = transliterate, not translate
      output_script: 'roman',
      model: 'mayura:v1',
    }),
  });

  if (!response.ok) {
    console.warn(`[sarvam] Transliteration failed (${response.status}): returning original`);
    return text;
  }

  const data: SarvamTranslationResponse = await response.json();
  return data.translated_text;
}

/**
 * Detect the spoken language by inspecting Unicode script blocks in the transcribed text.
 * Sarvam transcribes in 'transcribe' mode (native script), so Tamil speech → Tamil script
 * characters, Hindi speech → Devanagari, etc. This is more reliable than Sarvam's
 * language_code field, which often returns 'en-IN' for code-mixed Indian-English speech.
 *
 * Returns a Sarvam locale code (e.g. 'ta-IN') if an Indian script is dominant (>10% of
 * non-whitespace chars), or null if the text is Latin-only / ambiguous.
 */
export function detectLanguageFromScript(text: string): string | null {
  if (!text) return null;

  const ranges: Array<{ lo: number; hi: number; lang: string }> = [
    { lo: 0x0B80, hi: 0x0BFF, lang: 'ta-IN' },  // Tamil
    { lo: 0x0900, hi: 0x097F, lang: 'hi-IN' },  // Devanagari (Hindi / Marathi)
    { lo: 0x0C00, hi: 0x0C7F, lang: 'te-IN' },  // Telugu
    { lo: 0x0C80, hi: 0x0CFF, lang: 'kn-IN' },  // Kannada
    { lo: 0x0D00, hi: 0x0D7F, lang: 'ml-IN' },  // Malayalam
    { lo: 0x0980, hi: 0x09FF, lang: 'bn-IN' },  // Bengali
    { lo: 0x0A80, hi: 0x0AFF, lang: 'gu-IN' },  // Gujarati
    { lo: 0x0A00, hi: 0x0A7F, lang: 'pa-IN' },  // Gurmukhi (Punjabi)
    { lo: 0x0B00, hi: 0x0B7F, lang: 'or-IN' },  // Odia
  ];

  const counts: Record<string, number> = {};
  let total = 0;

  for (const char of text) {
    if (/\s/.test(char)) continue;
    total++;
    const cp = char.codePointAt(0)!;
    for (const { lo, hi, lang } of ranges) {
      if (cp >= lo && cp <= hi) {
        counts[lang] = (counts[lang] ?? 0) + 1;
        break;
      }
    }
  }

  if (total === 0) return null;

  let best: string | null = null;
  let bestCount = 0;
  for (const [lang, count] of Object.entries(counts)) {
    if (count > bestCount) { best = lang; bestCount = count; }
  }

  // Require at least 10% of non-whitespace chars to be in the script to avoid
  // false positives on text that has stray non-Latin characters.
  return best && bestCount / total >= 0.10 ? best : null;
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
