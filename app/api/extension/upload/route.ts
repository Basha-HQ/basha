/**
 * POST /api/extension/upload
 * Receives the WebM audio blob from the Chrome extension and triggers the AI pipeline.
 * Returns 202 immediately; processing happens asynchronously.
 * Auth: Extension Bearer token.
 *
 * Audio is stored as BYTEA in meetings.audio_data so it survives Railway restarts.
 * audio_path is set to the internal /api/meetings/:id/audio serve endpoint.
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

    const formData = await req.formData().catch((e) => {
      console.error('[extension/upload] formData parse error:', e);
      return null;
    });
    if (!formData) {
      return NextResponse.json({ error: 'Invalid multipart data — body may be too large or malformed' }, { status: 400 });
    }

    const meetingId = formData.get('meetingId') as string | null;
    const audioFile = formData.get('audio') as File | null;
    const durationRaw = formData.get('duration');
    const duration = durationRaw ? Math.round(Number(durationRaw)) : null;

    if (!meetingId || !audioFile) {
      return NextResponse.json({ error: 'meetingId and audio are required' }, { status: 400 });
    }

    // Verify the meeting belongs to this user and is in 'recording' state
    const meeting = await queryOne<{ id: string; source_language: string; status: string }>(
      `SELECT id, source_language, status FROM meetings WHERE id = $1 AND user_id = $2`,
      [meetingId, userId]
    );

    // Fetch user preferences
    const userPrefs = await queryOne<{ speaking_language: string }>(
      `SELECT speaking_language FROM users WHERE id = $1`,
      [userId]
    );

    if (!meeting) {
      return NextResponse.json({ error: 'Meeting not found' }, { status: 404 });
    }

    if (meeting.status === 'processing' || meeting.status === 'completed') {
      return NextResponse.json({ error: 'Meeting already processed' }, { status: 409 });
    }

    // Read audio into buffer
    const ext = audioFile.name?.split('.').pop() || 'webm';
    const fileName = `${meetingId}.${ext}`;
    const audioBuffer = Buffer.from(await audioFile.arrayBuffer());

    // Persist audio in DB (BYTEA) — survives Railway restarts, no temp file needed
    // audio_path points to the internal serve endpoint for stable browser playback
    await query(
      `UPDATE meetings SET audio_data = $1, audio_path = $2, duration = $3 WHERE id = $4`,
      [audioBuffer, `/api/meetings/${meetingId}/audio`, duration, meetingId]
    );

    // Trigger pipeline — after() keeps the Vercel function alive until the promise
    // settles even after the 202 response has been sent. Without this, Vercel
    // terminates the function context mid-pipeline, killing the pg Pool connection.
    after(
      processAudioForMeeting({
        meetingId,
        audioBuffer,
        fileName,
        sourceLanguage: meeting.source_language ?? 'auto',
        speakingLanguage: userPrefs?.speaking_language ?? undefined,
      }).catch((err) => {
        console.error(`[extension/upload] Pipeline error for meeting ${meetingId}:`, err);
      })
    );

    return NextResponse.json(
      {
        meetingId,
        processingUrl: `/meetings/${meetingId}`,
      },
      { status: 202 }
    );
  } catch (err) {
    console.error('[extension/upload] Unhandled error:', err);
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
  }
}
