import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/config';
import { query, queryOne } from '@/lib/db';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';

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

  // Save file to disk
  const uploadDir = path.join(process.cwd(), 'public', 'uploads', session.user.id);
  await mkdir(uploadDir, { recursive: true });

  const ext = file.name.split('.').pop() ?? 'wav';
  const fileName = `${id}.${ext}`;
  const filePath = path.join(uploadDir, fileName);

  const bytes = await file.arrayBuffer();
  await writeFile(filePath, Buffer.from(bytes));

  const relativeAudioPath = `/uploads/${session.user.id}/${fileName}`;

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
