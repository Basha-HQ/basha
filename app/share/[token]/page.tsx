import { notFound } from 'next/navigation';
import { queryOne, query } from '@/lib/db';
import { MeetingSummaryCard } from '@/components/transcript/MeetingSummaryCard';
import { TranscriptViewer } from '@/components/transcript/TranscriptViewer';
import Link from 'next/link';

interface Meeting {
  id: string;
  title: string;
  platform: string;
  created_at: string;
  duration: number | null;
  summary: string | null;
  source_language: string | null;
  speaker_labels: Record<string, string> | null;
}

interface TranscriptRow {
  id: string;
  segment_index: number;
  timestamp_seconds: number;
  original_text: string;
  english_text: string | null;
  speaker: string | null;
}

function platformLabel(p: string) {
  if (p === 'google_meet') return 'Google Meet';
  if (p === 'zoom') return 'Zoom';
  return 'Meeting';
}

export async function generateMetadata({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const meeting = await queryOne<{ title: string }>(
    `SELECT title FROM meetings WHERE share_token = $1 AND status = 'completed'`,
    [token]
  );
  if (!meeting) return { title: 'Shared Meeting — Basha' };
  return { title: `${meeting.title} — Basha` };
}

export default async function SharePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  const meeting = await queryOne<Meeting>(
    `SELECT id, title, platform, created_at, duration, summary, source_language, speaker_labels
     FROM meetings
     WHERE share_token = $1 AND status = 'completed'`,
    [token]
  );

  if (!meeting) notFound();

  const transcripts = await query<TranscriptRow>(
    `SELECT id, segment_index, timestamp_seconds, original_text, english_text, speaker
     FROM transcripts WHERE meeting_id = $1 ORDER BY segment_index`,
    [meeting.id]
  );

  const summary = meeting.summary ? JSON.parse(meeting.summary) : null;

  return (
    <div
      className="min-h-screen"
      style={{
        background: `
          radial-gradient(ellipse 80% 40% at 50% -10%, rgba(99,102,241,0.15) 0%, transparent 60%),
          radial-gradient(circle, rgba(99,102,241,0.06) 1px, transparent 1px)
        `,
        backgroundSize: '100% 100%, 36px 36px',
        backgroundColor: '#07071a',
        color: 'rgba(255,255,255,0.85)',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      }}
    >
      {/* Shared-by banner */}
      <div
        className="w-full py-2.5 px-4 text-center text-xs"
        style={{ background: 'rgba(99,102,241,0.1)', borderBottom: '1px solid rgba(99,102,241,0.2)', color: '#a5b4fc' }}
      >
        Shared via{' '}
        <Link href="/" className="font-bold hover:underline" style={{ color: '#c4b5fd' }}>
          Basha
        </Link>
        {' '}— bot-free meeting recorder for Indian languages
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-10 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold mb-2" style={{ color: 'rgba(255,255,255,0.92)' }}>
            {meeting.title}
          </h1>
          <div className="flex flex-wrap items-center gap-2 text-sm" style={{ color: 'rgba(255,255,255,0.4)' }}>
            <span>{platformLabel(meeting.platform)}</span>
            <span style={{ color: 'rgba(255,255,255,0.15)' }}>·</span>
            <span>
              {new Date(meeting.created_at).toLocaleDateString('en-IN', {
                day: 'numeric', month: 'long', year: 'numeric',
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

        {/* Summary + Transcript */}
        <div className="space-y-6">
          {summary && (
            <MeetingSummaryCard
              summary={summary}
              duration={meeting.duration}
              meetingTitle={meeting.title}
            />
          )}

          {transcripts.length > 0 && (
            <TranscriptViewer
              meetingId={meeting.id}
              transcripts={transcripts}
              meetingTitle={meeting.title}
              speakerLabels={meeting.speaker_labels ?? undefined}
              readOnly
            />
          )}
        </div>

        {/* Footer CTA */}
        <div className="mt-12 pt-8 text-center" style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }}>
          <p className="text-sm mb-4" style={{ color: 'rgba(255,255,255,0.4)' }}>
            Want Hinglish, Tanglish & multi-language transcripts for your meetings?
          </p>
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold"
            style={{
              background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
              color: 'white',
            }}
          >
            Try Basha free →
          </Link>
        </div>
      </div>
    </div>
  );
}
