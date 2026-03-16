import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/config';
import { queryOne } from '@/lib/db';
import { processAudioForMeeting } from '@/lib/recording/pipeline';
import { readFile } from 'fs/promises';
import path from 'path';

interface MeetingRow {
  id: string;
  title: string;
  audio_path: string;
  status: string;
  source_language: string;
}

// POST /api/meetings/[id]/process — trigger the AI processing pipeline
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  const meeting = await queryOne<MeetingRow>(
    'SELECT id, title, audio_path, status, source_language FROM meetings WHERE id = $1 AND user_id = $2',
    [id, session.user.id]
  );

  if (!meeting) {
    return NextResponse.json({ error: 'Meeting not found' }, { status: 404 });
  }

  if (!meeting.audio_path) {
    return NextResponse.json({ error: 'No audio file uploaded yet' }, { status: 400 });
  }

  if (meeting.status === 'processing') {
    return NextResponse.json({ error: 'Already processing' }, { status: 409 });
  }

  try {
    // Resolve audio to a Buffer
    let audioBuffer: Buffer;
    let fileName: string;
    if (meeting.audio_path.startsWith('http')) {
      const res = await fetch(meeting.audio_path);
      if (!res.ok) throw new Error(`Failed to fetch audio: ${res.status}`);
      audioBuffer = Buffer.from(await res.arrayBuffer());
      fileName = path.basename(new URL(meeting.audio_path).pathname) || 'audio.wav';
    } else if (path.isAbsolute(meeting.audio_path)) {
      audioBuffer = await readFile(meeting.audio_path);
      fileName = path.basename(meeting.audio_path);
    } else {
      const audioFilePath = path.join(process.cwd(), 'public', meeting.audio_path);
      audioBuffer = await readFile(audioFilePath);
      fileName = path.basename(audioFilePath);
    }

    await processAudioForMeeting({
      meetingId: id,
      audioBuffer,
      fileName,
      sourceLanguage: meeting.source_language ?? 'auto',
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Processing error:', err);
    return NextResponse.json(
      { error: 'Processing failed', details: String(err) },
      { status: 500 }
    );
  }
}
