/**
 * LLM-based translation fallback for Roman-script Indian languages.
 *
 * Used when Sarvam translate skips translation (returns identical text) because
 * the STT translit mode always reports language_code='en-IN' for any Indian language
 * written in Roman letters (Tanglish, Hinglish, Tenglish, etc.).
 *
 * Claude Haiku handles code-mixed Roman-script Indian languages well and is cheap
 * (~$0.001/meeting). ANTHROPIC_API_KEY is already required by the app.
 */

import Anthropic from '@anthropic-ai/sdk';

let _client: Anthropic | null = null;

function getClient(): Anthropic {
  if (!_client) {
    _client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return _client;
}

/**
 * Translate text written in Roman-script Indian languages (Tanglish, Hinglish, etc.)
 * to English using Claude Haiku.
 *
 * Returns the original text on any error — never throws.
 */
export async function translateWithLLM(romanScriptText: string): Promise<string> {
  if (!romanScriptText.trim()) return romanScriptText;

  try {
    const message = await getClient().messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 512,
      messages: [
        {
          role: 'user',
          content:
            'Translate the following text to English. It is a regional Indian language ' +
            '(Tamil, Hindi, Telugu, Kannada, Malayalam, Marathi, etc.) written in Roman/English ' +
            'letters (commonly called Tanglish, Hinglish, etc.). ' +
            'Output ONLY the English translation, nothing else.\n\n' +
            `Text: ${romanScriptText}`,
        },
      ],
    });

    const block = message.content[0];
    return block.type === 'text' ? block.text.trim() : romanScriptText;
  } catch (err) {
    console.error('[llm-translate] Translation failed, returning original:', err);
    return romanScriptText;
  }
}
