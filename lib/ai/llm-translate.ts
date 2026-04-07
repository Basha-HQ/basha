/**
 * LLM-based translation for Roman-script Indian languages (Tanglish, Hinglish, etc.)
 *
 * Used by the pipeline for translit-mode STT output — Sarvam translate is designed
 * for native script (e.g., தமிழ்) and doesn't handle Roman-script input reliably.
 *
 * Uses OpenRouter (same API key as summarize.ts) with a free Qwen model.
 * Never throws — returns the original text on any error so the pipeline continues.
 */

const OPENROUTER_BASE = 'https://openrouter.ai/api/v1';
const TRANSLATE_MODEL = 'qwen/qwen3.6-plus:free';
const FALLBACK_MODEL = 'nvidia/nemotron-3-nano-30b-a3b:free';

async function callModel(model: string, text: string, apiKey: string): Promise<Response> {
  const prompt =
    'Translate the following text to English. It is a regional Indian language ' +
    '(Tamil, Hindi, Telugu, Kannada, Malayalam, Marathi, etc.) written in Roman/English ' +
    'letters (commonly called Tanglish, Hinglish, etc.). ' +
    'Output ONLY the English translation, nothing else.\n\n' +
    `Text: ${text}`;

  return fetch(`${OPENROUTER_BASE}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL ?? 'https://trybasha.in',
      'X-Title': 'Basha',
    },
    body: JSON.stringify({
      model,
      max_tokens: 512,
      messages: [{ role: 'user', content: prompt }],
    }),
  });
}

export async function translateWithLLM(romanScriptText: string): Promise<string> {
  if (!romanScriptText.trim()) return romanScriptText;

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    console.warn('[llm-translate] OPENROUTER_API_KEY not set — returning original text');
    return romanScriptText;
  }

  try {
    let response = await callModel(TRANSLATE_MODEL, romanScriptText, apiKey);

    // Fall back to Nemotron if primary model is rate-limited upstream
    if (response.status === 429) {
      console.warn(`[llm-translate] ${TRANSLATE_MODEL} rate-limited, falling back to ${FALLBACK_MODEL}`);
      response = await callModel(FALLBACK_MODEL, romanScriptText, apiKey);
    }

    if (!response.ok) {
      const err = await response.text().catch(() => response.status.toString());
      console.error(`[llm-translate] OpenRouter error ${response.status}: ${err}`);
      return romanScriptText;
    }

    const data = await response.json();
    const translated: string = data.choices?.[0]?.message?.content?.trim() ?? '';
    return translated || romanScriptText;
  } catch (err) {
    console.error('[llm-translate] Request failed, returning original:', err);
    return romanScriptText;
  }
}
