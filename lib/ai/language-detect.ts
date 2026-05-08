/**
 * LLM-based language tiebreaker for transcripts.
 *
 * Sarvam's `language_code` response often mislabels code-mixed Indian-English
 * speech as `en-IN`, and Unicode-script regex can't disambiguate transliterated
 * code-mixed text (e.g. "Aaj ka meeting" looks like ASCII English). This module
 * uses the existing OpenRouter Nemotron client to classify language from a
 * short transcript sample so the user never has to set `speaking_language`.
 */

const OPENROUTER_BASE = 'https://openrouter.ai/api/v1';
const OPENROUTER_MODEL = 'nvidia/nemotron-3-nano-30b-a3b:free';

const ALLOWED_CODES = new Set([
  'ta', 'hi', 'te', 'kn', 'ml', 'mr', 'bn', 'gu', 'pa', 'or', 'en', 'unknown',
]);

const LLM_TIMEOUT_MS = 4_000;

/**
 * Returns an ISO 639-1 code from {ta,hi,te,kn,ml,mr,bn,gu,pa,or,en} or null
 * if the LLM is unavailable, times out, or returns an out-of-set value.
 * The pipeline treats null as "fall through to next signal".
 */
export async function classifyLanguageWithLLM(textSample: string): Promise<string | null> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    console.warn('[language-detect] OPENROUTER_API_KEY missing — skipping LLM tiebreaker');
    return null;
  }

  const sample = (textSample ?? '').trim().slice(0, 200);
  if (sample.length < 8) return null;

  const prompt = `Identify the language of this speech transcript. Reply with ONE ISO 639-1 code from this set ONLY (no other text, no explanation, no punctuation): ta, hi, te, kn, ml, mr, bn, gu, pa, or, en, unknown.

Treat code-mixed Indian-English speech as the dominant Indian language (e.g. "Aaj ka meeting mein hum discuss karenge" → hi). Reply "en" only if the text is purely English with no Indian-language words.

Text: ${sample}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), LLM_TIMEOUT_MS);

  try {
    const response = await fetch(`${OPENROUTER_BASE}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL ?? 'https://trybasha.in',
        'X-Title': 'Basha',
      },
      body: JSON.stringify({
        model: OPENROUTER_MODEL,
        max_tokens: 8,
        temperature: 0,
        messages: [{ role: 'user', content: prompt }],
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      console.warn(`[language-detect] LLM responded ${response.status} — skipping`);
      return null;
    }

    const data = await response.json();
    const raw: string = data.choices?.[0]?.message?.content ?? '';
    const code = raw.trim().toLowerCase().replace(/[^a-z]/g, '');

    if (!ALLOWED_CODES.has(code) || code === 'unknown') {
      console.warn(`[language-detect] LLM returned out-of-set value: "${raw}"`);
      return null;
    }

    console.log(`[language-detect] LLM classified: ${code}`);
    return code;
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    console.warn(`[language-detect] LLM tiebreaker failed: ${reason}`);
    return null;
  } finally {
    clearTimeout(timer);
  }
}
