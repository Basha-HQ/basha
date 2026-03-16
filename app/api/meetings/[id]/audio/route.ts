import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/config';
import { query, queryOne } from '@/lib/db';
import { writeFile, mkdir, readFile, stat } from 'fs/promises';
import path from 'path';
import os from 'os';

// GET /api/meetings/[id]/audio — stream audio file for playback
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  const meeting = await queryOne<{ audio_path: string | null }>(
    'SELECT audio_path FROM meetings WHERE id = $1 AND user_id = $2',
    [id, session.user.id]
  );

  if (!meeting?.audio_path) {
    return NextResponse.json({ error: 'No audio file' }, { status: 404 });
  }

  // Resolve the file path — could be absolute (temp dir) or relative (public/uploads)
  const audioPath = path.isAbsolute(meeting.audio_path)
    ? meeting.audio_path
    : path.join(process.cwd(), meeting.audio_path);

  try {
    const fileStat = await stat(audioPath);
    const fileSize = fileStat.size;
    const ext = path.extname(audioPath).toLowerCase();
    const mimeMap: Record<string, string> = {
      '.webm': 'audio/webm',
      '.mp4': 'audio/mp4',
      '.mp3': 'audio/mpeg',
      '.wav': 'audio/wav',
      '.ogg': 'audio/ogg',
    };
    const contentType = mimeMap[ext] || 'audio/webm';

    const rangeHeader = _req.headers.get('range');

    if (rangeHeader) {
      // Implement range requests so browsers can seek in the audio file
      const match = rangeHeader.match(/bytes=(\d+)-(\d*)/);
      if (match) {
        const start = parseInt(match[1], 10);
        const end = match[2] ? parseInt(match[2], 10) : fileSize - 1;
        const clampedEnd = Math.min(end, fileSize - 1);
        const chunkSize = clampedEnd - start + 1;

        const fileBuffer = await readFile(audioPath);
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

    // No range header — return full file
    const fileBuffer = await readFile(audioPath);
    return new NextResponse(fileBuffer, {
      headers: {
        'Content-Type': contentType,
        'Content-Length': String(fileSize),
        'Accept-Ranges': 'bytes',
        'Cache-Control': 'private, max-age=3600',
      },
    });
  } catch {
    return NextResponse.json({ error: 'Audio file not found on disk' }, { status: 404 });
  }
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
  const uploadDir = path.join(os.tmpdir(), 'linguameet', session.user.id);
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
