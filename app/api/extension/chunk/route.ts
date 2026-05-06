/**
 * POST /api/extension/chunk
 * Receives a 30-second WebM audio chunk from the Chrome extension and immediately
 * runs STT + translation on it, inserting transcript rows into the DB in real-time.
 *
 * On the final chunk (isFinal=true), also generates summary and marks meeting completed.
 * Returns 202 immediately; all heavy processing runs via after().
 *
 * This enables unlimited meeting length:
 *  - Each chunk is ≤30s (~300 KB) — well under Vercel's 4.5 MB body limit
 *  - Sarvam sync STT handles ≤30s natively with no batch job timeout risk
 *
 * Auth: Extension Bearer token.
 */

import { NextRequest, NextResponse, after } from 'next/server';
import { getExtensionUser } from '@/lib/extension/auth';
import { queryOne } from '@/lib/db';
import { processAudioChunk } from '@/lib/recording/pipeline';

export async function POST(req: NextRequest) {
  try {
    const userId = await getExtensionUser(req.headers.get('authorization'));
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await req.formData().catch((e) => {
      console.error('[extension/chunk] formData parse error:', e);
      return null;
    });
    if (!formData) {
      return NextResponse.json({ error: 'Invalid multipart data' }, { status: 400 });
    }

    const meetingId = formData.get('meetingId') as string | null;
    const audioFile = formData.get('audio') as File | null;
    const chunkIndex = Number(formData.get('chunkIndex') ?? 0);
    const chunkStartSeconds = Number(formData.get('chunkStartSeconds') ?? 0);
    const isFinal = formData.get('isFinal') === 'true';
    const durationRaw = formData.get('duration');
    const duration = isFinal && durationRaw ? Math.round(Number(durationRaw)) : undefined;

    if (!meetingId || !audioFile) {
      return NextResponse.json({ error: 'meetingId and audio are required' }, { status: 400 });
    }

    // Verify meeting belongs to this user
    const [meeting, userPrefs] = await Promise.all([
      queryOne<{ id: string; source_language: string; status: string }>(
        `SELECT id, source_language, status FROM meetings WHERE id = $1 AND user_id = $2`,
        [meetingId, userId]
      ),
      queryOne<{ speaking_language: string }>(
        `SELECT speaking_language FROM users WHERE id = $1`,
        [userId]
      ),
    ]);
    if (!meeting) {
      return NextResponse.json({ error: 'Meeting not found' }, { status: 404 });
    }
    if (meeting.status === 'completed') {
      return NextResponse.json({ error: 'Meeting already completed' }, { status: 409 });
    }

    const ext = audioFile.name?.split('.').pop() || 'webm';
    const fileName = `${meetingId}_chunk${chunkIndex}.${ext}`;
    const audioBuffer = Buffer.from(await audioFile.arrayBuffer());

    console.log(
      `[extension/chunk] meetingId=${meetingId} chunk=${chunkIndex}`,
      `startSec=${chunkStartSeconds} isFinal=${isFinal} size=${audioBuffer.byteLength}B`
    );

    // Trigger processing asynchronously — after() keeps the Vercel function alive
    // until the promise settles even after the 202 response is sent.
    after(
      processAudioChunk({
        meetingId,
        audioBuffer,
        fileName,
        chunkStartSeconds,
        sourceLanguage: meeting.source_language ?? 'auto',
        speakingLanguage: userPrefs?.speaking_language ?? undefined,
        isFinal,
        duration,
      }).catch((err) => {
        console.error(`[extension/chunk] Pipeline error for meeting ${meetingId} chunk ${chunkIndex}:`, err);
      })
    );

    return NextResponse.json({ ok: true, chunkIndex }, { status: 202 });
  } catch (err) {
    console.error('[extension/chunk] Unhandled error:', err);
    return NextResponse.json({ error: 'Chunk upload failed' }, { status: 500 });
  }
}
