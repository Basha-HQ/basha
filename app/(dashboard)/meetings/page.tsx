import { auth } from '@/lib/auth/config';
import { query } from '@/lib/db';
import Link from 'next/link';
import { MeetingFilters } from '@/components/meetings/MeetingFilters';

interface Meeting {
  id: string;
  title: string;
  platform: string;
  status: string;
  created_at: string;
  duration: number | null;
  source_language: string | null;
}

export const metadata = { title: 'Meeting History — Basha' };

export default async function MeetingsPage() {
  const session = await auth();
  const userId = session!.user.id;

  const meetings = await query<Meeting>(
    `SELECT id, title, platform, status, created_at, duration, source_language
     FROM meetings
     WHERE user_id = $1
     ORDER BY created_at DESC`,
    [userId]
  );

  const completed = meetings.filter((m) => m.status === 'completed').length;
  const processing = meetings.filter((m) => m.status === 'processing').length;

  return (
    <div
      className="min-h-screen px-5 sm:px-8 lg:px-10 py-8"
      style={{
        background: `
          radial-gradient(ellipse 70% 30% at 50% -5%, rgba(129,140,248,0.08) 0%, transparent 55%)
        `,
        backgroundColor: '#07071a',
      }}
    >
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-5 mb-10 animate-fade-up-1">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: 'rgba(255,255,255,0.25)' }}>
              History
            </p>
            <div className="flex items-baseline gap-3">
              <h1 className="text-3xl sm:text-4xl font-bold tracking-tight" style={{ color: 'rgba(255,255,255,0.95)' }}>
                Meetings
              </h1>
              {meetings.length > 0 && (
                <span
                  className="text-sm font-semibold px-2.5 py-1 rounded-lg"
                  style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.45)', border: '1px solid rgba(255,255,255,0.08)' }}
                >
                  {meetings.length}
                </span>
              )}
            </div>
            {(completed > 0 || processing > 0) && (
              <div className="flex items-center gap-3 mt-2.5">
                {completed > 0 && (
                  <span className="flex items-center gap-1.5 text-xs font-light" style={{ color: 'rgba(52,211,153,0.7)' }}>
                    <span className="w-1.5 h-1.5 rounded-full" style={{ background: '#34d399', flexShrink: 0 }} />
                    {completed} completed
                  </span>
                )}
                {processing > 0 && (
                  <span className="flex items-center gap-1.5 text-xs font-light" style={{ color: 'rgba(129,140,248,0.7)' }}>
                    <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: '#818cf8', flexShrink: 0 }} />
                    {processing} processing
                  </span>
                )}
              </div>
            )}
          </div>
          <Link
            href="/new-meeting"
            className="btn-amber-shimmer inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold self-start hover:opacity-90 transition-opacity"
            style={{ color: '#07071a' }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Start Notetaker
          </Link>
        </div>

        {/* Content */}
        <div className="animate-fade-up-2">
          {meetings.length === 0 ? (
            <div
              className="rounded-xl p-16 sm:p-24 text-center"
              style={{ background: 'rgba(255,255,255,0.02)', border: '1px dashed rgba(255,255,255,0.07)' }}
            >
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center text-xl mx-auto mb-4"
                style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.15)' }}
              >
                📋
              </div>
              <p className="font-semibold text-sm mb-1.5" style={{ color: 'rgba(255,255,255,0.75)' }}>No meetings yet</p>
              <p className="text-xs font-light mb-6" style={{ color: 'rgba(255,255,255,0.3)' }}>
                Your recorded and transcribed meetings will appear here
              </p>
              <Link
                href="/new-meeting"
                className="btn-amber-shimmer inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold hover:opacity-90 transition-opacity"
                style={{ color: '#07071a' }}
              >
                Start your first meeting
              </Link>
            </div>
          ) : (
            <MeetingFilters meetings={meetings} />
          )}
        </div>
      </div>
    </div>
  );
}
