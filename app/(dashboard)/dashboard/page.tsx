import { auth } from '@/lib/auth/config';
import { query } from '@/lib/db';
import Link from 'next/link';
import { MeetingCard } from '@/components/meetings/MeetingCard';
import { UpcomingMeetingsWidget } from '@/components/dashboard/UpcomingMeetingsWidget';

interface Meeting {
  id: string;
  title: string;
  platform: string;
  status: string;
  created_at: string;
  duration: number | null;
  source_language: string | null;
}

export const metadata = { title: 'Dashboard — Basha' };

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

export default async function DashboardPage() {
  const session = await auth();
  const userId = session!.user.id;
  const firstName = session!.user.name?.split(' ')[0] ?? 'there';

  const recentMeetings = await query<Meeting>(
    `SELECT id, title, platform, status, created_at, duration, source_language
     FROM meetings
     WHERE user_id = $1
     ORDER BY created_at DESC
     LIMIT 5`,
    [userId]
  );

  const [stats] = await query<{ total: string; completed: string; processing: string }>(
    `SELECT
       COUNT(*) AS total,
       COUNT(*) FILTER (WHERE status = 'completed') AS completed,
       COUNT(*) FILTER (WHERE status = 'processing') AS processing
     FROM meetings WHERE user_id = $1`,
    [userId]
  );

  const statCards = [
    {
      label: 'Total',
      sublabel: 'Meetings',
      value: stats?.total ?? '0',
      accent: '#f59e0b',
      accentBg: 'rgba(245,158,11,0.06)',
      topBorder: '#f59e0b',
    },
    {
      label: 'Completed',
      sublabel: 'Transcribed',
      value: stats?.completed ?? '0',
      accent: '#34d399',
      accentBg: 'rgba(52,211,153,0.06)',
      topBorder: '#34d399',
    },
    {
      label: 'Processing',
      sublabel: 'In progress',
      value: stats?.processing ?? '0',
      accent: '#818cf8',
      accentBg: 'rgba(129,140,248,0.06)',
      topBorder: '#818cf8',
    },
  ];

  return (
    <div
      className="min-h-screen px-5 sm:px-8 lg:px-10 py-8"
      style={{
        background: `
          radial-gradient(ellipse 70% 35% at 60% -5%, rgba(245,158,11,0.07) 0%, transparent 60%),
          radial-gradient(circle, rgba(255,255,255,0.025) 1px, transparent 1px)
        `,
        backgroundSize: '100% 100%, 32px 32px',
        backgroundColor: '#07071a',
      }}
    >
      <div className="max-w-6xl mx-auto">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-5 mb-10 animate-fade-up-1">
          <div>
            <p
              className="text-xs font-semibold uppercase tracking-widest mb-2"
              style={{ color: '#f59e0b' }}
            >
              {getGreeting()}
            </p>
            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight" style={{ color: 'rgba(255,255,255,0.95)' }}>
              {firstName}
            </h1>
            <p className="text-sm mt-2 font-light" style={{ color: 'rgba(255,255,255,0.38)' }}>
              {Number(stats?.total ?? 0) === 0
                ? 'Your first Tanglish transcript is one meeting away.'
                : `${stats?.total} meeting${Number(stats?.total) !== 1 ? 's' : ''} transcribed so far`}
            </p>
          </div>
          <Link
            href="/new-meeting"
            className="btn-amber-shimmer inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold self-start sm:self-auto hover:opacity-90 transition-opacity"
            style={{ color: '#07071a' }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Start Notetaker
          </Link>
        </div>

        {/* Bento stat cards */}
        <div className="grid grid-cols-3 gap-px mb-10 animate-fade-up-2 overflow-hidden rounded-xl" style={{ background: 'rgba(255,255,255,0.05)' }}>
          {statCards.map((s) => (
            <div
              key={s.label}
              className="flex flex-col justify-between p-5 sm:p-6"
              style={{
                background: '#07071a',
                borderTop: `2px solid ${s.topBorder}`,
              }}
            >
              <div
                className="text-4xl sm:text-5xl font-bold leading-none mb-3"
                style={{ color: s.accent }}
              >
                {s.value}
              </div>
              <div>
                <p className="text-sm font-semibold" style={{ color: 'rgba(255,255,255,0.75)' }}>{s.label}</p>
                <p className="text-xs font-light mt-0.5 uppercase tracking-wide" style={{ color: 'rgba(255,255,255,0.28)' }}>{s.sublabel}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Two-column content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Recent meetings */}
          <div className="lg:col-span-2 animate-fade-up-3">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-sm font-semibold uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.4)' }}>
                Recent meetings
              </h2>
              <Link
                href="/meetings"
                className="text-xs font-medium transition-opacity hover:opacity-70 flex items-center gap-1"
                style={{ color: '#f59e0b' }}
              >
                View all
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </Link>
            </div>

            {recentMeetings.length === 0 ? (
              <div
                className="rounded-xl p-14 text-center"
                style={{
                  background: 'rgba(255,255,255,0.02)',
                  border: '1px dashed rgba(255,255,255,0.08)',
                }}
              >
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center text-xl mx-auto mb-4"
                  style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.15)' }}
                >
                  🎙️
                </div>
                <p className="font-semibold text-sm mb-1.5" style={{ color: 'rgba(255,255,255,0.75)' }}>No meetings yet</p>
                <p className="text-xs font-light mb-6" style={{ color: 'rgba(255,255,255,0.3)' }}>
                  Start a notetaker to record and transcribe your first meeting
                </p>
                <Link
                  href="/new-meeting"
                  className="btn-amber-shimmer inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold hover:opacity-90 transition-opacity"
                  style={{ color: '#07071a' }}
                >
                  Start Notetaker
                </Link>
              </div>
            ) : (
              <div className="space-y-1.5">
                {recentMeetings.map((m) => (
                  <MeetingCard key={m.id} meeting={m} />
                ))}
              </div>
            )}
          </div>

          {/* Upcoming */}
          <div className="animate-fade-up-4">
            <h2 className="text-sm font-semibold uppercase tracking-widest mb-5" style={{ color: 'rgba(255,255,255,0.4)' }}>
              Upcoming
            </h2>
            <UpcomingMeetingsWidget />
          </div>
        </div>
      </div>
    </div>
  );
}
