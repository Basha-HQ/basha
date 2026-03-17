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

export const metadata = { title: 'Dashboard — LinguaMeet' };

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
      label: 'Total Meetings',
      value: stats?.total ?? '0',
      icon: '🎙️',
      accent: '#6366f1',
      accentBg: 'rgba(99,102,241,0.1)',
      accentBorder: 'rgba(99,102,241,0.2)',
    },
    {
      label: 'Completed',
      value: stats?.completed ?? '0',
      icon: '✅',
      accent: '#34d399',
      accentBg: 'rgba(52,211,153,0.1)',
      accentBorder: 'rgba(52,211,153,0.2)',
    },
    {
      label: 'Processing',
      value: stats?.processing ?? '0',
      icon: '⚡',
      accent: '#f59e0b',
      accentBg: 'rgba(245,158,11,0.1)',
      accentBorder: 'rgba(245,158,11,0.2)',
    },
  ];

  return (
    <div
      className="min-h-screen px-4 sm:px-6 lg:px-10 py-8"
      style={{
        background: `
          radial-gradient(ellipse 80% 40% at 50% -10%, rgba(99,102,241,0.18) 0%, transparent 60%),
          radial-gradient(circle, rgba(99,102,241,0.06) 1px, transparent 1px)
        `,
        backgroundSize: '100% 100%, 36px 36px',
        backgroundColor: '#07071a',
      }}
    >
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-10 animate-fade-up-1">
          <div>
            <p className="text-sm font-medium mb-1" style={{ color: '#f59e0b' }}>
              {getGreeting()} 👋
            </p>
            <h1 className="text-2xl sm:text-3xl font-bold" style={{ color: 'rgba(255,255,255,0.92)' }}>
              Welcome back, <span style={{ color: '#f59e0b' }}>{firstName}</span>
            </h1>
            <p className="text-sm mt-1" style={{ color: 'rgba(255,255,255,0.4)' }}>
              {Number(stats?.total ?? 0) === 0
                ? 'Start your first meeting to see your notes here'
                : `${stats?.total} meeting${Number(stats?.total) !== 1 ? 's' : ''} transcribed so far`}
            </p>
          </div>
          <Link
            href="/new-meeting"
            className="btn-amber-shimmer inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold self-start sm:self-auto hover:scale-105 transition-transform"
            style={{ color: '#07071a' }}
          >
            + Start Notetaker
          </Link>
        </div>

        {/* Stat cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-10 animate-fade-up-2">
          {statCards.map((s) => (
            <div
              key={s.label}
              className="rounded-2xl p-5 flex items-center gap-4"
              style={{
                background: 'rgba(255,255,255,0.03)',
                border: `1px solid ${s.accentBorder}`,
              }}
            >
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
                style={{ background: s.accentBg, border: `1px solid ${s.accentBorder}` }}
              >
                {s.icon}
              </div>
              <div>
                <p className="text-3xl font-bold leading-none" style={{ color: s.accent }}>{s.value}</p>
                <p className="text-sm mt-1" style={{ color: 'rgba(255,255,255,0.45)' }}>{s.label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Two-column content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Recent meetings */}
          <div className="lg:col-span-2 animate-fade-up-3">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold" style={{ color: 'rgba(255,255,255,0.85)' }}>
                Recent meetings
              </h2>
              <Link
                href="/meetings"
                className="text-sm font-medium transition-colors"
                style={{ color: '#f59e0b' }}
              >
                View all →
              </Link>
            </div>

            {recentMeetings.length === 0 ? (
              <div
                className="rounded-2xl p-12 sm:p-16 text-center"
                style={{
                  background: 'rgba(255,255,255,0.02)',
                  border: '1px dashed rgba(255,255,255,0.1)',
                }}
              >
                <div
                  className="w-16 h-16 rounded-2xl flex items-center justify-center text-2xl mx-auto mb-4"
                  style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.2)' }}
                >
                  🎙️
                </div>
                <p className="font-semibold mb-2" style={{ color: 'rgba(255,255,255,0.85)' }}>No meetings yet</p>
                <p className="text-sm mb-6" style={{ color: 'rgba(255,255,255,0.35)' }}>
                  Start a notetaker to record and transcribe your first meeting
                </p>
                <Link
                  href="/new-meeting"
                  className="btn-amber-shimmer inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold hover:scale-105 transition-transform"
                  style={{ color: '#07071a' }}
                >
                  Start Notetaker
                </Link>
              </div>
            ) : (
              <div className="space-y-2">
                {recentMeetings.map((m) => (
                  <MeetingCard key={m.id} meeting={m} />
                ))}
              </div>
            )}
          </div>

          {/* Upcoming */}
          <div className="animate-fade-up-4">
            <h2 className="text-base font-semibold mb-4" style={{ color: 'rgba(255,255,255,0.85)' }}>
              Upcoming
            </h2>
            <UpcomingMeetingsWidget />
          </div>
        </div>
      </div>
    </div>
  );
}
