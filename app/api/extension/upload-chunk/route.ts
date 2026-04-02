/**
 * POST /api/extension/upload-chunk
 * Receives one chunk of a large audio recording from the Chrome extension.
 * When the final chunk arrives, reassembles the full buffer, stores it in the
 * meetings table, and triggers the AI pipeline — same as /api/extension/upload.
 *
 * This route exists to work around Vercel's 4.5 MB serverless payload limit.
 * The extension splits recordings larger than 3 MB into 3 MB pieces.
 *
 * FormData fields:
 *   audio        — Blob slice for this chunk
 *   meetingId    — UUID of the meeting
 *   chunkIndex   — 0-based index of this chunk
 *   totalChunks  — total number of chunks in this upload
 *   duration     — (last chunk only) recording duration in seconds
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
    const chunkIndex = Number(formData.get('chunkIndex'));
    const totalChunks = Number(formData.get('totalChunks'));
    const durationRaw = formData.get('duration');
    const duration = durationRaw ? Math.round(Number(durationRaw)) : null;

    if (!meetingId || !audioFile || isNaN(chunkIndex) || isNaN(totalChunks) || totalChunks < 1) {
      return NextResponse.json({ error: 'meetingId, audio, chunkIndex, and totalChunks are required' }, { status: 400 });
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

    // Store this chunk
    const chunkBuffer = Buffer.from(await audioFile.arrayBuffer());
    await query(
      `INSERT INTO upload_chunks (meeting_id, chunk_index, total_chunks, data)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (meeting_id, chunk_index) DO UPDATE SET data = EXCLUDED.data`,
      [meetingId, chunkIndex, totalChunks, chunkBuffer]
    );

    // Check how many chunks we have now
    const countRow = await queryOne<{ count: string }>(
      `SELECT COUNT(*) AS count FROM upload_chunks WHERE meeting_id = $1`,
      [meetingId]
    );
    const received = parseInt(countRow?.count ?? '0', 10);

    if (received < totalChunks) {
      return NextResponse.json({ status: 'chunk_received', received, total: totalChunks });
    }

    // ── All chunks received — reassemble ──────────────────────────────────────
    const chunkRows = await query<{ data: Buffer }>(
      `SELECT data FROM upload_chunks WHERE meeting_id = $1 ORDER BY chunk_index ASC`,
      [meetingId]
    );
    const audioBuffer = Buffer.concat(chunkRows.rows.map((r) => r.data));

    // Clean up chunk rows immediately
    await query(`DELETE FROM upload_chunks WHERE meeting_id = $1`, [meetingId]);

    // Fetch user output_script preference
    const userPrefs = await queryOne<{ output_script: string }>(
      `SELECT output_script FROM users WHERE id = $1`,
      [userId]
    );

    const fileName = `${meetingId}.webm`;

    // Persist reassembled audio in the meetings row
    await query(
      `UPDATE meetings SET audio_data = $1, audio_path = $2, duration = $3 WHERE id = $4`,
      [audioBuffer, `/api/meetings/${meetingId}/audio`, duration, meetingId]
    );

    after(
      processAudioForMeeting({
        meetingId,
        audioBuffer,
        fileName,
        sourceLanguage: meeting.source_language ?? 'auto',
        outputScript: (userPrefs?.output_script ?? 'roman') as 'roman' | 'fully-native' | 'spoken-form-in-native',
      }).catch((err) => {
        console.error(`[extension/upload-chunk] Pipeline error for meeting ${meetingId}:`, err);
      })
    );

    return NextResponse.json({ meetingId, processingUrl: `/meetings/${meetingId}` }, { status: 202 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[extension/upload-chunk] Unhandled error:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
