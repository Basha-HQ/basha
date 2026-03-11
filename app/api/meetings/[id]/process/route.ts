import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/config';
import { query, queryOne } from '@/lib/db';
import { transcribeAudio, translateToEnglish, splitIntoSegments } from '@/lib/ai/sarvam';
import { generateSummary } from '@/lib/ai/summarize';
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

  // Mark as processing
  await query("UPDATE meetings SET status = 'processing' WHERE id = $1", [id]);

  try {
    // Step 1: Read audio file
    const audioFilePath = path.join(process.cwd(), 'public', meeting.audio_path);
    const audioBuffer = await readFile(audioFilePath);
    const fileName = path.basename(audioFilePath);

    // Step 2: Transcribe with Sarvam AI
    const sttResult = await transcribeAudio(audioBuffer, fileName);

    // Step 3: Detect language
    // Use Sarvam's detected language; fall back to per-meeting source_language if detection was inconclusive
    const detectedLang = sttResult.language_code && sttResult.language_code !== 'unknown'
      ? sttResult.language_code
      : (meeting.source_language ?? 'auto');

    const englishSegments: string[] = [];

    // Step 4: Translate each segment + store (diarization-aware)
    const hasDiarization = (sttResult.diarized_entries?.length ?? 0) > 0;

    if (hasDiarization) {
      // Use diarized entries: real timestamps + speaker labels
      const entries = sttResult.diarized_entries!;
      for (let i = 0; i < entries.length; i++) {
        const entry = entries[i];
        const englishText = await translateToEnglish(entry.transcript, detectedLang);
        englishSegments.push(englishText);
        await query(
          `INSERT INTO transcripts
             (meeting_id, segment_index, timestamp_seconds, original_text, english_text, speaker)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [id, i, Math.round(entry.start), entry.transcript, englishText, entry.speaker]
        );
      }
    } else {
      // Fallback: split by sentence, no speaker stored
      const segments = splitIntoSegments(sttResult.transcript, 0);
      for (let i = 0; i < segments.length; i++) {
        const seg = segments[i];
        const englishText = await translateToEnglish(seg.text, detectedLang);
        englishSegments.push(englishText);
        await query(
          `INSERT INTO transcripts
             (meeting_id, segment_index, timestamp_seconds, original_text, english_text)
           VALUES ($1, $2, $3, $4, $5)`,
          [id, i, seg.startSeconds, seg.text, englishText]
        );
      }
    }

    // Step 5: Generate summary from full English transcript
    const fullEnglishTranscript = englishSegments.join(' ');
    const summary = await generateSummary(fullEnglishTranscript, meeting.title);

    // Step 6: Mark meeting as completed
    await query(
      `UPDATE meetings
       SET status = 'completed', summary = $1, completed_at = NOW()
       WHERE id = $2`,
      [JSON.stringify(summary), id]
    );

    return NextResponse.json({ success: true, segmentsProcessed: segments.length });
  } catch (err) {
    console.error('Processing error:', err);
    await query("UPDATE meetings SET status = 'failed' WHERE id = $1", [id]);
    return NextResponse.json(
      { error: 'Processing failed', details: String(err) },
      { status: 500 }
    );
  }
}
