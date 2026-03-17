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

export const metadata = { title: 'Meeting History — LinguaMeet' };

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
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-8 animate-fade-up-1">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold" style={{ color: 'rgba(255,255,255,0.92)' }}>
              Meeting History
            </h1>
            <div className="flex flex-wrap items-center gap-2 mt-2">
              <span className="text-sm" style={{ color: 'rgba(255,255,255,0.4)' }}>
                {meetings.length} meeting{meetings.length !== 1 ? 's' : ''}
              </span>
              {completed > 0 && (
                <>
                  <span style={{ color: 'rgba(255,255,255,0.15)' }}>·</span>
                  <span
                    className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full"
                    style={{ color: '#34d399', background: 'rgba(52,211,153,0.1)', border: '1px solid rgba(52,211,153,0.2)' }}
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />
                    {completed} completed
                  </span>
                </>
              )}
              {processing > 0 && (
                <>
                  <span style={{ color: 'rgba(255,255,255,0.15)' }}>·</span>
                  <span
                    className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full"
                    style={{ color: '#6366f1', background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.25)' }}
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 inline-block animate-pulse" />
                    {processing} processing
                  </span>
                </>
              )}
            </div>
          </div>
          <Link
            href="/new-meeting"
            className="btn-amber-shimmer inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold self-start hover:scale-105 transition-transform"
            style={{ color: '#07071a' }}
          >
            + Start Notetaker
          </Link>
        </div>

        {/* Content */}
        <div className="animate-fade-up-2">
          {meetings.length === 0 ? (
            <div
              className="rounded-2xl p-16 sm:p-24 text-center"
              style={{ background: 'rgba(255,255,255,0.02)', border: '1px dashed rgba(255,255,255,0.08)' }}
            >
              <div
                className="w-16 h-16 rounded-2xl flex items-center justify-center text-2xl mx-auto mb-4"
                style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.2)' }}
              >
                📋
              </div>
              <p className="font-semibold mb-2" style={{ color: 'rgba(255,255,255,0.85)' }}>No meetings yet</p>
              <p className="text-sm mb-6" style={{ color: 'rgba(255,255,255,0.35)' }}>
                Your recorded and transcribed meetings will appear here
              </p>
              <Link
                href="/new-meeting"
                className="btn-amber-shimmer inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold hover:scale-105 transition-transform"
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
