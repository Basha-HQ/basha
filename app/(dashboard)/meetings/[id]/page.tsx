import { auth } from '@/lib/auth/config';
import { queryOne, query } from '@/lib/db';
import { notFound } from 'next/navigation';
import { TranscriptViewer } from '@/components/transcript/TranscriptViewer';
import { MeetingSummaryCard } from '@/components/transcript/MeetingSummaryCard';
import { MeetingStatusPoller } from '@/components/meetings/MeetingStatusPoller';
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

function platformLabel(p: string) {
  if (p === 'google_meet') return 'Google Meet';
  if (p === 'zoom') return 'Zoom';
  return 'Other';
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

  // Fetch associated bot so the status poller can poll it
  const bot = await queryOne<{ id: string; status: string; error: string | null }>(
    `SELECT id, status, error FROM bots WHERE meeting_id = $1 ORDER BY created_at DESC LIMIT 1`,
    [id]
  );

  const inProgress = ['recording', 'processing'].includes(meeting.status);

  return (
    <div
      className="min-h-screen px-4 sm:px-6 lg:px-10 py-8"
      style={{
        background: `
          radial-gradient(ellipse 80% 40% at 50% -10%, rgba(99,102,241,0.15) 0%, transparent 60%),
          radial-gradient(circle, rgba(99,102,241,0.06) 1px, transparent 1px)
        `,
        backgroundSize: '100% 100%, 36px 36px',
        backgroundColor: '#07071a',
      }}
    >
      <div className="max-w-4xl mx-auto">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm mb-6" style={{ color: 'rgba(255,255,255,0.35)' }}>
          <Link href="/meetings" className="transition-colors hover:text-amber-400" style={{ color: 'rgba(255,255,255,0.4)' }}>
            Meeting History
          </Link>
          <span>/</span>
          <span className="truncate max-w-xs" style={{ color: 'rgba(255,255,255,0.6)' }}>{meeting.title}</span>
        </div>

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold" style={{ color: 'rgba(255,255,255,0.92)' }}>
              {meeting.title}
            </h1>
            <div className="flex flex-wrap items-center gap-2 mt-2 text-sm" style={{ color: 'rgba(255,255,255,0.4)' }}>
              <span>{platformLabel(meeting.platform)}</span>
              <span style={{ color: 'rgba(255,255,255,0.15)' }}>·</span>
              <span>
                {new Date(meeting.created_at).toLocaleDateString('en-IN', {
                  day: 'numeric', month: 'long', year: 'numeric',
                  hour: '2-digit', minute: '2-digit',
                })}
              </span>
              {meeting.duration && (
                <>
                  <span style={{ color: 'rgba(255,255,255,0.15)' }}>·</span>
                  <span>{Math.round(meeting.duration / 60)} min</span>
                </>
              )}
            </div>
          </div>

          {/* Status badge */}
          {(() => {
            const cfg: Record<string, { color: string; bg: string; border: string }> = {
              completed: { color: '#34d399', bg: 'rgba(52,211,153,0.1)', border: 'rgba(52,211,153,0.2)' },
              processing: { color: '#6366f1', bg: 'rgba(99,102,241,0.12)', border: 'rgba(99,102,241,0.25)' },
              recording: { color: '#f59e0b', bg: 'rgba(245,158,11,0.1)', border: 'rgba(245,158,11,0.2)' },
              failed: { color: '#fb7185', bg: 'rgba(251,113,133,0.1)', border: 'rgba(251,113,133,0.2)' },
              pending: { color: 'rgba(255,255,255,0.4)', bg: 'rgba(255,255,255,0.05)', border: 'rgba(255,255,255,0.1)' },
            };
            const s = cfg[meeting.status] ?? cfg.pending;
            return (
              <span
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-semibold self-start"
                style={{ color: s.color, background: s.bg, border: `1px solid ${s.border}` }}
              >
                {inProgress && <span className="w-1.5 h-1.5 rounded-full inline-block animate-pulse" style={{ background: s.color }} />}
                {meeting.status.charAt(0).toUpperCase() + meeting.status.slice(1)}
              </span>
            );
          })()}
        </div>

        {/* Status banners */}
        {meeting.status === 'recording' && (
          <div
            className="rounded-2xl p-6 text-center mb-8"
            style={{ background: 'rgba(245,158,11,0.07)', border: '1px solid rgba(245,158,11,0.18)' }}
          >
            <p className="text-2xl mb-2">🤖</p>
            <p className="font-semibold" style={{ color: 'rgba(255,255,255,0.85)' }}>
              {bot ? 'Bot is active — waiting for the meeting to finish' : 'Waiting for audio'}
            </p>
            <p className="text-sm mt-1" style={{ color: 'rgba(255,255,255,0.4)' }}>
              {bot
                ? 'Transcription will start automatically once the meeting ends and the recording is ready.'
                : 'Upload audio from the meeting to start processing.'}
            </p>
            {bot && <MeetingStatusPoller botId={bot.id} meetingStatus={meeting.status} />}
          </div>
        )}

        {meeting.status === 'processing' && (
          <div
            className="rounded-2xl p-6 text-center mb-8"
            style={{ background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)' }}
          >
            <p className="text-2xl mb-2 animate-pulse">🧠</p>
            <p className="font-semibold" style={{ color: 'rgba(255,255,255,0.85)' }}>
              Transcribing and translating…
            </p>
            <p className="text-sm mt-1" style={{ color: 'rgba(255,255,255,0.4)' }}>
              This usually takes 1–3 minutes. The page will update automatically.
            </p>
            {bot && <MeetingStatusPoller botId={bot.id} meetingStatus={meeting.status} />}
          </div>
        )}

        {meeting.status === 'failed' && (
          <div
            className="rounded-2xl p-6 text-center mb-8"
            style={{ background: 'rgba(251,113,133,0.07)', border: '1px solid rgba(251,113,133,0.18)' }}
          >
            <p className="text-2xl mb-2">⚠️</p>
            <p className="font-semibold" style={{ color: 'rgba(255,255,255,0.85)' }}>Processing failed</p>
            {bot?.error && (
              <p className="text-sm mt-1 font-mono" style={{ color: '#fb7185' }}>{bot.error}</p>
            )}
            <p className="text-sm mt-2" style={{ color: 'rgba(255,255,255,0.35)' }}>
              Try starting a new notetaker for this meeting.
            </p>
            <Link
              href="/new-meeting"
              className="inline-flex items-center gap-2 mt-4 px-4 py-2.5 rounded-xl text-sm font-bold btn-amber-shimmer"
              style={{ color: '#07071a' }}
            >
              Start new notetaker
            </Link>
          </div>
        )}

        {meeting.status === 'pending' && (
          <div
            className="rounded-2xl p-6 text-center mb-8"
            style={{ background: 'rgba(255,255,255,0.03)', border: '1px dashed rgba(255,255,255,0.1)' }}
          >
            <p className="text-2xl mb-2">⏳</p>
            <p className="font-semibold" style={{ color: 'rgba(255,255,255,0.85)' }}>Waiting for audio</p>
            <p className="text-sm mt-1" style={{ color: 'rgba(255,255,255,0.4)' }}>
              Upload audio from the meeting to start processing.
            </p>
          </div>
        )}

        {/* Completed — show summary + transcript */}
        {meeting.status === 'completed' && (
          <div className="space-y-6">
            {summary && <MeetingSummaryCard summary={summary} />}
            <TranscriptViewer meetingId={id} transcripts={transcripts} meetingTitle={meeting.title} />
          </div>
        )}
      </div>
    </div>
  );
}
