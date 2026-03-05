import { auth } from '@/lib/auth/config';
import { queryOne, query } from '@/lib/db';
import { notFound } from 'next/navigation';
import { Badge, statusToBadgeVariant } from '@/components/ui/Badge';
import { TranscriptViewer } from '@/components/transcript/TranscriptViewer';
import { MeetingSummaryCard } from '@/components/transcript/MeetingSummaryCard';
import Link from 'next/link';

interface Meeting {
  id: string;
  title: string;
  meeting_link: string;
  platform: string;
  status: string;
  duration: number | null;
  summary: string | null;
  created_at: string;
  completed_at: string | null;
}

interface TranscriptRow {
  id: string;
  segment_index: number;
  timestamp_seconds: number;
  original_text: string;
  english_text: string | null;
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return { title: `Meeting ${id.slice(0, 8)} — LinguaMeet` };
}

export default async function MeetingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();
  const userId = session!.user.id;

  const meeting = await queryOne<Meeting>(
    `SELECT id, title, meeting_link, platform, status, duration, summary, created_at, completed_at
     FROM meetings WHERE id = $1 AND user_id = $2`,
    [id, userId]
  );

  if (!meeting) notFound();

  const transcripts = await query<TranscriptRow>(
    `SELECT id, segment_index, timestamp_seconds, original_text, english_text
     FROM transcripts WHERE meeting_id = $1 ORDER BY segment_index`,
    [id]
  );

  const summary = meeting.summary ? JSON.parse(meeting.summary) : null;

  function platformLabel(p: string) {
    if (p === 'google_meet') return 'Google Meet';
    if (p === 'zoom') return 'Zoom';
    return 'Other';
  }

  return (
    <div className="px-8 py-8">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-gray-400 mb-6">
        <Link href="/meetings" className="hover:text-gray-600">Meeting History</Link>
        <span>/</span>
        <span className="text-gray-700 truncate max-w-xs">{meeting.title}</span>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{meeting.title}</h1>
          <div className="flex items-center gap-3 mt-2 text-sm text-gray-500">
            <span>{platformLabel(meeting.platform)}</span>
            <span>·</span>
            <span>
              {new Date(meeting.created_at).toLocaleDateString('en-IN', {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </span>
            {meeting.duration && (
              <>
                <span>·</span>
                <span>{Math.round(meeting.duration / 60)} min</span>
              </>
            )}
          </div>
        </div>
        <Badge variant={statusToBadgeVariant(meeting.status)} className="text-sm px-3 py-1">
          {meeting.status.charAt(0).toUpperCase() + meeting.status.slice(1)}
        </Badge>
      </div>

      {/* Status-based content */}
      {meeting.status === 'processing' && (
        <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-6 text-center mb-6">
          <p className="text-2xl mb-2 animate-pulse">🧠</p>
          <p className="font-medium text-indigo-800">Processing your meeting...</p>
          <p className="text-sm text-indigo-600 mt-1">
            Transcription and translation in progress. Refresh to check status.
          </p>
        </div>
      )}

      {meeting.status === 'failed' && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center mb-6">
          <p className="text-2xl mb-2">⚠️</p>
          <p className="font-medium text-red-800">Processing failed</p>
          <p className="text-sm text-red-600 mt-1">
            There was an error processing this meeting. Please try again.
          </p>
        </div>
      )}

      {meeting.status === 'completed' && (
        <div className="space-y-6">
          {/* Summary */}
          {summary && <MeetingSummaryCard summary={summary} />}

          {/* Transcript viewer */}
          <TranscriptViewer
            meetingId={id}
            transcripts={transcripts}
            meetingTitle={meeting.title}
          />
        </div>
      )}

      {(meeting.status === 'pending' || meeting.status === 'recording') && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-6 text-center">
          <p className="text-2xl mb-2">⏳</p>
          <p className="font-medium text-yellow-800">Waiting for audio</p>
          <p className="text-sm text-yellow-700 mt-1">
            Upload audio from the meeting to start processing.
          </p>
        </div>
      )}
    </div>
  );
}
