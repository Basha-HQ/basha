/**
 * Meeting summary generation using Claude Haiku (cheapest model).
 */

import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

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

  const message = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1024,
    messages: [{ role: 'user', content: prompt }],
  });

  const content = message.content[0];
  if (content.type !== 'text') {
    throw new Error('Unexpected response type from Claude');
  }

  // Extract JSON from the response
  const jsonMatch = content.text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('Could not parse summary JSON from Claude response');
  }

  const parsed = JSON.parse(jsonMatch[0]);

  return {
    topics: parsed.topics ?? [],
    decisions: parsed.decisions ?? [],
    notes: parsed.notes ?? [],
    rawSummary: content.text,
  };
}
