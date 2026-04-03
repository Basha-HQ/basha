/**
 * Meeting summary generation using OpenRouter (nvidia/nemotron-3-nano-30b free model).
 * OpenRouter exposes an OpenAI-compatible API — no extra SDK needed.
 */

const OPENROUTER_BASE = 'https://openrouter.ai/api/v1';
const OPENROUTER_MODEL = 'nvidia/nemotron-3-nano-30b-a3b:free';

export interface MeetingSummary {
  overview?: string;
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

1. A brief overview (1-2 sentences describing the main purpose and outcome)
2. Topics Discussed (bullet points)
3. Key Decisions Made (bullet points)
4. Important Notes / Action Items (bullet points)

Meeting: ${meetingTitle ?? 'Team Meeting'}

Transcript:
${englishTranscript}

Respond in this exact JSON format:
{
  "overview": "1-2 sentences capturing the main purpose and outcome of this meeting.",
  "topics": ["topic 1", "topic 2"],
  "decisions": ["decision 1", "decision 2"],
  "notes": ["note 1", "note 2"]
}

Be concise. The overview must be 1–2 sentences. If a section has no content, use an empty array.`;

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
    overview: typeof parsed.overview === 'string' && parsed.overview.trim()
      ? parsed.overview.trim()
      : undefined,
    topics: parsed.topics ?? [],
    decisions: parsed.decisions ?? [],
    notes: parsed.notes ?? [],
    rawSummary: text,
  };
}

/**
 * Generate a short, descriptive meeting title from the summary.
 * Uses topics + overview for richer context. Returns an empty string on failure.
 */
export async function generateMeetingTitle(summary: MeetingSummary): Promise<string> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) return '';

  const topicsText = summary.topics.slice(0, 5).join(', ');
  const overviewText = summary.overview?.slice(0, 200) ?? '';

  // Need at least some content to generate a meaningful title
  if (!topicsText && !overviewText) return '';

  const context = [
    topicsText ? `Topics: ${topicsText}` : '',
    overviewText ? `Overview: ${overviewText}` : '',
  ].filter(Boolean).join('\n');

  const prompt = `Based on this meeting summary:
${context}

Write a short, specific meeting title (4-8 words). No quotes, no punctuation at the end.
Examples: Q2 Product Roadmap Planning, Marketing Campaign Budget Review, Engineering Sprint Retrospective

Respond with only the title, nothing else.`;

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
        max_tokens: 32,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!response.ok) {
      console.warn('[summarize] generateMeetingTitle failed:', response.status);
      return '';
    }
    const data = await response.json();
    const raw: string = data.choices?.[0]?.message?.content?.trim() ?? '';
    const title = raw
      .replace(/^["'`]|["'`]$/g, '') // strip surrounding quotes
      .replace(/[.!?]+$/, '')         // strip trailing punctuation
      .trim();

    // Sanity check: reject if too long (model hallucinated) or empty
    const wordCount = title.split(/\s+/).filter(Boolean).length;
    if (!title || wordCount < 2 || wordCount > 12) return '';
    return title;
  } catch (err) {
    console.warn('[summarize] generateMeetingTitle error:', err);
    return '';
  }
}
