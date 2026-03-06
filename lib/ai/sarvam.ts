/**
 * Sarvam AI integration for:
 * - Speech-to-text (multilingual, code-mixed)
 * - Translation to English
 */

const SARVAM_BASE_URL = 'https://api.sarvam.ai';

export interface SarvamSTTResponse {
  transcript: string;
  language_code: string;
  language_probability?: number;
  // segments is not returned by saaras:v3 — use splitIntoSegments() as fallback
}

export interface SarvamTranslationResponse {
  translated_text: string;
  source_language_code: string;
}

/**
 * Transcribe audio file using Sarvam AI speech-to-text.
 * Supports multilingual and code-mixed speech.
 */
export async function transcribeAudio(
  audioBuffer: Buffer,
  fileName: string
): Promise<SarvamSTTResponse> {
  const apiKey = process.env.SARVAM_API_KEY;
  if (!apiKey) throw new Error('SARVAM_API_KEY is not set');

  const formData = new FormData();
  const blob = new Blob([audioBuffer.buffer as ArrayBuffer], { type: 'audio/wav' });
  formData.append('file', blob, fileName);
  formData.append('model', 'saaras:v3');
  formData.append('mode', 'transcribe'); // transcribe in original language; we translate separately

  const response = await fetch(`${SARVAM_BASE_URL}/speech-to-text`, {
    method: 'POST',
    headers: {
      'api-subscription-key': apiKey,
    },
    body: formData,
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Sarvam STT failed: ${response.status} ${error}`);
  }

  return response.json();
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

  // Map language codes to Sarvam format
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
