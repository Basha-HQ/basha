import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/config';
import { query, queryOne } from '@/lib/db';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
import os from 'os';

// GET /api/meetings/[id]/audio — serve audio stored as BYTEA in the database
// Supports range requests so browsers can seek within the audio player.
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  const row = await queryOne<{ audio_data: Buffer | null; recorder_type: string | null }>(
    `SELECT audio_data, recorder_type FROM meetings WHERE id = $1 AND user_id = $2`,
    [id, session.user.id]
  );

  if (!row) {
    return NextResponse.json({ error: 'Meeting not found' }, { status: 404 });
  }

  if (!row.audio_data) {
    return NextResponse.json({ error: 'Audio not available' }, { status: 404 });
  }

  // pg returns BYTEA as Buffer; convert to Uint8Array for NextResponse compatibility
  const fileBuffer = new Uint8Array(row.audio_data);
  const fileSize = fileBuffer.length;
  // Bot path may produce mp4; extension always produces webm
  const contentType = row.recorder_type === 'bot' ? 'audio/mp4' : 'audio/webm';

  const rangeHeader = req.headers.get('range');
  if (rangeHeader) {
    const match = rangeHeader.match(/bytes=(\d+)-(\d*)/);
    if (match) {
      const start = parseInt(match[1], 10);
      const end = match[2] ? parseInt(match[2], 10) : fileSize - 1;
      const clampedEnd = Math.min(end, fileSize - 1);
      const chunkSize = clampedEnd - start + 1;
      const chunk = fileBuffer.subarray(start, clampedEnd + 1);
      return new NextResponse(chunk, {
        status: 206,
        headers: {
          'Content-Type': contentType,
          'Content-Range': `bytes ${start}-${clampedEnd}/${fileSize}`,
          'Accept-Ranges': 'bytes',
          'Content-Length': String(chunkSize),
          'Cache-Control': 'private, max-age=3600',
        },
      });
    }
  }

  return new NextResponse(fileBuffer, {
    status: 200,
    headers: {
      'Content-Type': contentType,
      'Content-Length': String(fileSize),
      'Accept-Ranges': 'bytes',
      'Cache-Control': 'private, max-age=3600',
    },
  });
}

// POST /api/meetings/[id]/audio — upload audio file for a meeting
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  // Verify meeting belongs to user
  const meeting = await queryOne<{ id: string; status: string }>(
    'SELECT id, status FROM meetings WHERE id = $1 AND user_id = $2',
    [id, session.user.id]
  );

  if (!meeting) {
    return NextResponse.json({ error: 'Meeting not found' }, { status: 404 });
  }

  const formData = await req.formData();
  const file = formData.get('audio') as File | null;

  if (!file) {
    return NextResponse.json({ error: 'No audio file provided' }, { status: 400 });
  }

  // Validate file type
  const allowedTypes = ['audio/wav', 'audio/mp3', 'audio/mpeg', 'audio/ogg', 'audio/webm', 'audio/mp4'];
  if (!allowedTypes.includes(file.type)) {
    return NextResponse.json(
      { error: 'Invalid file type. Supported: WAV, MP3, OGG, WebM' },
      { status: 400 }
    );
  }

  // Max 200MB
  const maxSize = 200 * 1024 * 1024;
  if (file.size > maxSize) {
    return NextResponse.json({ error: 'File too large. Max 200MB' }, { status: 400 });
  }

  // Save file to writable tmp dir (works on Vercel serverless)
  const uploadDir = path.join(os.tmpdir(), 'basha', session.user.id);
  await mkdir(uploadDir, { recursive: true });

  const ext = file.name.split('.').pop() ?? 'wav';
  const fileName = `${id}.${ext}`;
  const filePath = path.join(uploadDir, fileName);

  const bytes = await file.arrayBuffer();
  await writeFile(filePath, Buffer.from(bytes));

  // Store absolute path so process route can read it regardless of cwd
  const relativeAudioPath = filePath;

  // Update meeting with audio path and set to processing
  await query(
    `UPDATE meetings SET audio_path = $1, status = 'recording' WHERE id = $2`,
    [relativeAudioPath, id]
  );

  return NextResponse.json({
    success: true,
    audioPath: relativeAudioPath,
  });
}
