import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/config';
import { query, queryOne } from '@/lib/db';
import { transcriptToTxt, TranscriptRow } from '@/lib/utils/transcript';

interface MeetingRow {
  id: string;
  title: string;
  created_at: string;
  user_id: string;
}

// GET /api/meetings/[id]/transcript — get transcript rows (with optional search)
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const { searchParams } = new URL(req.url);
  const searchQuery = searchParams.get('q')?.trim();
  const download = searchParams.get('download') === 'true';

  // Verify meeting ownership
  const meeting = await queryOne<MeetingRow>(
    'SELECT id, title, created_at, user_id FROM meetings WHERE id = $1 AND user_id = $2',
    [id, session.user.id]
  );

  if (!meeting) {
    return NextResponse.json({ error: 'Meeting not found' }, { status: 404 });
  }

  let transcripts: TranscriptRow[];

  if (searchQuery) {
    // Full-text search
    transcripts = await query<TranscriptRow>(
      `SELECT id, segment_index, timestamp_seconds, original_text, english_text
       FROM transcripts
       WHERE meeting_id = $1
         AND (
           original_text ILIKE $2
           OR english_text ILIKE $2
         )
       ORDER BY segment_index`,
      [id, `%${searchQuery}%`]
    );
  } else {
    transcripts = await query<TranscriptRow>(
      `SELECT id, segment_index, timestamp_seconds, original_text, english_text
       FROM transcripts
       WHERE meeting_id = $1
       ORDER BY segment_index`,
      [id]
    );
  }

  // Return as TXT file for download
  if (download) {
    const txt = transcriptToTxt(transcripts, meeting.title, meeting.created_at);
    return new NextResponse(txt, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Content-Disposition': `attachment; filename="transcript-${id}.txt"`,
      },
    });
  }

  return NextResponse.json({ transcripts });
}
