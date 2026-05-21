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

  // Truncate very long transcripts. Strategy: keep the first 12k chars (covers ~75 min)
  // plus the last 8k chars (covers ~50 min from end) so summaries cover start and end
  // of even a 2-hour meeting. Total 20k chars ≈ 5,000 tokens — within free model limits.
  const MAX_TRANSCRIPT_CHARS = 20_000;
  const transcript = englishTranscript.length > MAX_TRANSCRIPT_CHARS
    ? englishTranscript.slice(0, 12_000) + '\n\n[...middle of meeting truncated for summary...]\n\n' + englishTranscript.slice(-8_000)
    : englishTranscript;

  const prompt = `You are a meeting notes assistant. Analyze the following meeting transcript and extract:

1. A brief overview (1-2 sentences describing the main purpose and outcome)
2. Topics Discussed (bullet points)
3. Key Decisions Made (bullet points)
4. Important Notes / Action Items (bullet points)

Meeting: ${meetingTitle ?? 'Team Meeting'}

Transcript:
${transcript}

Respond in this exact JSON format:
{
  "overview": "1-2 sentences capturing the main purpose and outcome of this meeting.",
  "topics": ["topic 1", "topic 2"],
  "decisions": ["decision 1", "decision 2"],
  "notes": ["note 1", "note 2"]
}

Be concise. The overview must be 1–2 sentences. If a section has no content, use an empty array.`;

  console.log(`[summarize] Generating summary — transcript length: ${englishTranscript.length}${englishTranscript.length > MAX_TRANSCRIPT_CHARS ? ' (truncated to ' + MAX_TRANSCRIPT_CHARS + ')' : ''}`);
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
      max_tokens: 2048,
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
    console.error(`[summarize] Failed to parse JSON — raw response: "${text.slice(0, 300)}"`);
    throw new Error('Could not parse summary JSON from model response');
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let parsed: any = {};
  try {
    parsed = JSON.parse(jsonMatch[0]);
  } catch {
    // Model may have truncated mid-JSON — try to close open arrays/objects and re-parse
    try {
      const repaired = jsonMatch[0].trimEnd().replace(/,\s*$/, '') + ']}';
      parsed = JSON.parse(repaired);
      console.warn('[summarize] Used partial-JSON repair to recover truncated response');
    } catch {
      console.error(`[summarize] JSON repair failed — raw response: "${text.slice(0, 300)}"`);
      throw new Error('Could not parse summary JSON from model response');
    }
  }
  console.log(`[summarize] Summary parsed — topics: ${parsed.topics?.length ?? 0}, decisions: ${parsed.decisions?.length ?? 0}`);

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

Write a short, specific meeting title. Rules:
- Exactly 3 to 6 words
- Every word separated by a single space (no joined or concatenated words)
- Title case, no quotes, no punctuation at the end
Examples: Q2 Product Roadmap Planning, Marketing Budget Review, Engineering Sprint Retrospective

Respond with only the title, nothing else.`;

  try {
    console.log('[summarize] Generating meeting title');
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
      .replace(/\s{2,}/g, ' ')        // collapse double-spaces
      .trim();

    // Sanity check: reject if too long (model hallucinated) or empty
    const wordCount = title.split(/\s+/).filter(Boolean).length;
    if (!title || wordCount < 2 || wordCount > 6) return '';
    console.log(`[summarize] Title generated: "${title}"`);
    return title;
  } catch (err) {
    console.warn('[summarize] generateMeetingTitle error:', err);
    return '';
  }
}
