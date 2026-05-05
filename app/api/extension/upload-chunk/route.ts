/**
 * POST /api/extension/upload-chunk
 * Receives one raw WebM chunk from the Chrome extension during recording.
 * Chunks are stored in upload_chunks until the final chunk arrives,
 * then the full audio is reassembled and the AI pipeline runs once.
 *
 * This is the "accumulate and process once" model:
 *   - No per-chunk STT — proper diarization across the full meeting
 *   - Each chunk is ≤30s (~300 KB) — stays under Vercel's 4.5 MB body limit
 *   - Server reassembles chunks in order → single Sarvam batch job
 *
 * FormData fields:
 *   audio        — raw WebM blob slice (chunk 0 includes EBML header)
 *   meetingId    — UUID of the meeting
 *   chunkIndex   — 0-based sequence number
 *   isFinal      — "true" on the last chunk to trigger assembly + pipeline
 *   duration     — (last chunk only) total recording duration in seconds
 *
 * Auth: Extension Bearer token.
 */

import { NextRequest, NextResponse, after } from 'next/server';
import { getExtensionUser } from '@/lib/extension/auth';
import { queryOne, query } from '@/lib/db';
import { processAudioForMeeting } from '@/lib/recording/pipeline';

export async function POST(req: NextRequest) {
  try {
    const userId = await getExtensionUser(req.headers.get('authorization'));
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await req.formData().catch(() => null);
    if (!formData) {
      return NextResponse.json({ error: 'Invalid multipart data' }, { status: 400 });
    }

    const meetingId = formData.get('meetingId') as string | null;
    const audioFile = formData.get('audio') as File | null;
    const chunkIndex = Number(formData.get('chunkIndex') ?? 0);
    const isFinal = formData.get('isFinal') === 'true';
    const durationRaw = formData.get('duration');
    const duration = isFinal && durationRaw ? Math.round(Number(durationRaw)) : null;

    if (!meetingId || !audioFile) {
      return NextResponse.json({ error: 'meetingId and audio are required' }, { status: 400 });
    }

    // Verify meeting ownership
    const meeting = await queryOne<{ id: string; source_language: string; status: string }>(
      `SELECT id, source_language, status FROM meetings WHERE id = $1 AND user_id = $2`,
      [meetingId, userId]
    );
    if (!meeting) {
      return NextResponse.json({ error: 'Meeting not found' }, { status: 404 });
    }
    if (meeting.status === 'processing' || meeting.status === 'completed') {
      return NextResponse.json({ error: 'Meeting already processed' }, { status: 409 });
    }

    // Store this raw chunk (total_chunks is now nullable — no longer used)
    const chunkBuffer = Buffer.from(await audioFile.arrayBuffer());

    console.log(
      `[extension/upload-chunk] meetingId=${meetingId} chunk=${chunkIndex}`,
      `isFinal=${isFinal} size=${chunkBuffer.byteLength}B`
    );

    await query(
      `INSERT INTO upload_chunks (meeting_id, chunk_index, total_chunks, data)
       VALUES ($1, $2, NULL, $3)
       ON CONFLICT (meeting_id, chunk_index) DO UPDATE SET data = EXCLUDED.data`,
      [meetingId, chunkIndex, chunkBuffer]
    );

    if (!isFinal) {
      return NextResponse.json({ status: 'chunk_received', chunkIndex });
    }

    // ── Final chunk received — reassemble full audio ──────────────────────────
    const chunkRows = await query<{ data: Buffer }>(
      `SELECT data FROM upload_chunks WHERE meeting_id = $1 ORDER BY chunk_index ASC`,
      [meetingId]
    );

    if (chunkRows.length === 0) {
      return NextResponse.json({ error: 'No chunks found for meeting' }, { status: 422 });
    }

    const audioBuffer = Buffer.concat(chunkRows.map((r) => r.data));

    // Clean up chunk rows immediately (frees DB space)
    await query(`DELETE FROM upload_chunks WHERE meeting_id = $1`, [meetingId]);

    // Fetch user preferences
    const userPrefs = await queryOne<{ speaking_language: string }>(
      `SELECT speaking_language FROM users WHERE id = $1`,
      [userId]
    );

    const fileName = `${meetingId}.webm`;

    // Persist reassembled audio for playback
    await query(
      `UPDATE meetings SET audio_data = $1, audio_path = $2, duration = $3 WHERE id = $4`,
      [audioBuffer, `/api/meetings/${meetingId}/audio`, duration, meetingId]
    );

    console.log(
      `[extension/upload-chunk] Reassembled ${chunkRows.length} chunks → ${audioBuffer.byteLength}B`,
      `for meeting ${meetingId}. Triggering pipeline.`
    );

    // Run the full AI pipeline once on the complete audio
    after(
      processAudioForMeeting({
        meetingId,
        audioBuffer,
        fileName,
        sourceLanguage: meeting.source_language ?? 'auto',
        speakingLanguage: userPrefs?.speaking_language ?? undefined,
      }).catch((err) => {
        console.error(`[extension/upload-chunk] Pipeline error for meeting ${meetingId}:`, err);
      })
    );

    return NextResponse.json({ meetingId, processingUrl: `/meetings/${meetingId}` }, { status: 202 });
  } catch (err) {
    console.error('[extension/upload-chunk] Unhandled error:', err);
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
  }
}
