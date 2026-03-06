/**
 * Meeting summary generation using OpenRouter (nvidia/nemotron-3-nano-30b free model).
 * OpenRouter exposes an OpenAI-compatible API — no extra SDK needed.
 */

const OPENROUTER_BASE = 'https://openrouter.ai/api/v1';
const OPENROUTER_MODEL = 'nvidia/nemotron-3-nano-30b-a3b:free';

export interface MeetingSummary {
  topics: string[];
  decisions: string[];
  notes: string[];
  rawSummary: string;
}

/**
 * Generate a structured meeting summary from the English transcript.
 */
export async function generateSummary(
  englishTranscript: string,
  meetingTitle?: string
): Promise<MeetingSummary> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error('OPENROUTER_API_KEY is not set');

  const prompt = `You are a meeting notes assistant. Analyze the following meeting transcript and extract:

1. Topics Discussed (bullet points)
2. Key Decisions Made (bullet points)
3. Important Notes / Action Items (bullet points)

Meeting: ${meetingTitle ?? 'Team Meeting'}

Transcript:
${englishTranscript}

Respond in this exact JSON format:
{
  "topics": ["topic 1", "topic 2"],
  "decisions": ["decision 1", "decision 2"],
  "notes": ["note 1", "note 2"]
}

Be concise. If a section has no content, use an empty array.`;

  const response = await fetch(`${OPENROUTER_BASE}/chat/completions`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://linguameet.app',
      'X-Title': 'LinguaMeet',
    },
    body: JSON.stringify({
      model: OPENROUTER_MODEL,
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenRouter API error: ${response.status} ${error}`);
  }

  const data = await response.json();
  const text: string = data.choices?.[0]?.message?.content ?? '';

  if (!text) throw new Error('Empty response from OpenRouter');

  // Extract JSON from the response (model may wrap it in markdown)
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('Could not parse summary JSON from model response');
  }

  const parsed = JSON.parse(jsonMatch[0]);

  return {
    topics: parsed.topics ?? [],
    decisions: parsed.decisions ?? [],
    notes: parsed.notes ?? [],
    rawSummary: text,
  };
}
