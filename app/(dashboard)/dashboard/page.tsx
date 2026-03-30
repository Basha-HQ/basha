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

function formatRecordedTime(totalSeconds: number): { value: string; unit: string } {
  if (totalSeconds === 0) return { value: '0', unit: 'min' };
  const totalMinutes = Math.floor(totalSeconds / 60);
  if (totalMinutes < 60) return { value: String(totalMinutes), unit: 'min' };
  const hours = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;
  if (mins === 0) return { value: String(hours), unit: 'hr' };
  return { value: `${hours}h ${mins}m`, unit: '' };
}

export default async function DashboardPage() {
  const session = await auth();
  const userId = session!.user.id;
  const firstName = session!.user.name?.split(' ')[0] ?? 'there';

  const extensionToken = await query<{ count: string }>(
    `SELECT COUNT(*) as count FROM extension_tokens WHERE user_id = $1 AND expires_at > NOW()`,
    [userId]
  );
  const extensionConnected = Number(extensionToken[0]?.count ?? 0) > 0;

  const recentMeetings = await query<Meeting>(
    `SELECT id, title, platform, status, created_at, duration, source_language
     FROM meetings
     WHERE user_id = $1
     ORDER BY created_at DESC
     LIMIT 5`,
    [userId]
  );

  const [stats] = await query<{ total: string; completed: string; total_seconds: string }>(
    `SELECT
       COUNT(*) AS total,
       COUNT(*) FILTER (WHERE status = 'completed') AS completed,
       COALESCE(SUM(duration), 0) AS total_seconds
     FROM meetings WHERE user_id = $1`,
    [userId]
  );

  const totalSeconds = Number(stats?.total_seconds ?? 0);
  const recordedTime = formatRecordedTime(totalSeconds);

  const statCards = [
    {
      key: 'total',
      value: stats?.total ?? '0',
      unit: null,
      label: 'Meetings',
      sublabel: 'Recorded',
      accent: '#f59e0b',
      topBorder: '#f59e0b',
    },
    {
      key: 'time',
      value: recordedTime.value,
      unit: recordedTime.unit || null,
      label: 'Hours',
      sublabel: 'Of conversation',
      accent: '#a78bfa',
      topBorder: '#a78bfa',
    },
    {
      key: 'completed',
      value: stats?.completed ?? '0',
      unit: null,
      label: 'Transcribed',
      sublabel: 'Successfully',
      accent: '#34d399',
      topBorder: '#34d399',
    },
  ];

  const quickStartSteps = [
    {
      done: extensionConnected,
      label: 'Install Chrome Extension',
      sublabel: 'One-time setup for bot-free recording',
      href: '/settings#integrations',
      cta: 'Set up',
    },
    {
      done: Number(stats?.total ?? 0) > 0,
      label: 'Record your first meeting',
      sublabel: 'Open a Meet tab and click the Basha icon',
      href: '/new-meeting',
      cta: 'Start',
    },
    {
      done: Number(stats?.completed ?? 0) > 0,
      label: 'Read your first transcript',
      sublabel: 'Hinglish, Tanglish — all preserved',
      href: '/meetings',
      cta: 'View',
    },
  ];
  const allDone = quickStartSteps.every((s) => s.done);

  const quickStartPanel = !allDone ? (
    <div
      className="rounded-xl p-5 space-y-4"
      style={{
        background: 'rgba(255,255,255,0.02)',
        border: '1px solid rgba(255,255,255,0.07)',
      }}
    >
      <h3
        className="text-xs font-semibold uppercase tracking-widest"
        style={{ color: 'rgba(255,255,255,0.3)' }}
      >
        Getting started
      </h3>
      <ol className="space-y-3">
        {quickStartSteps.map((step, i) => (
          <li key={i} className="flex items-start gap-3">
            <div
              className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 text-[10px] font-bold"
              style={{
                background: step.done ? 'rgba(52,211,153,0.15)' : 'rgba(255,255,255,0.05)',
                border: step.done ? '1px solid rgba(52,211,153,0.3)' : '1px solid rgba(255,255,255,0.1)',
                color: step.done ? '#34d399' : 'rgba(255,255,255,0.3)',
              }}
            >
              {step.done ? '✓' : i + 1}
            </div>
            <div className="flex-1 min-w-0">
              <p
                className="text-sm font-medium leading-snug"
                style={{
                  color: step.done ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.78)',
                  textDecoration: step.done ? 'line-through' : 'none',
                }}
              >
                {step.label}
              </p>
              {!step.done && (
                <>
                  <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.28)' }}>
                    {step.sublabel}
                  </p>
                  <a
                    href={step.href}
                    className="inline-block mt-1.5 text-xs font-semibold transition-opacity hover:opacity-70"
                    style={{ color: '#f59e0b' }}
                  >
                    {step.cta} →
                  </a>
                </>
              )}
            </div>
          </li>
        ))}
      </ol>
    </div>
  ) : null;

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
                : totalSeconds > 0
                  ? `${recordedTime.value}${recordedTime.unit ? ' ' + recordedTime.unit : ''} of meetings captured so far`
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

        {/* Extension not connected banner */}
        {!extensionConnected && (
          <div
            className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl mb-6 animate-fade-up-2"
            style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)' }}
          >
            <p className="text-sm" style={{ color: 'rgba(255,255,255,0.6)' }}>
              Chrome Extension not connected — Basha can&apos;t record meetings yet.
            </p>
            <a
              href="/settings#integrations"
              className="text-xs font-semibold whitespace-nowrap flex items-center gap-1 hover:opacity-80 transition-opacity"
              style={{ color: '#f59e0b' }}
            >
              Set it up
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </a>
          </div>
        )}

        {/* Bento stat cards */}
        <div className="grid grid-cols-3 gap-px mb-10 animate-fade-up-2 overflow-hidden rounded-xl" style={{ background: 'rgba(255,255,255,0.05)' }}>
          {statCards.map((s) => (
            <div
              key={s.key}
              className="flex flex-col justify-between p-5 sm:p-6"
              style={{ background: '#07071a', borderTop: `2px solid ${s.topBorder}` }}
            >
              <div className="flex items-baseline gap-1.5 mb-3">
                <span
                  className="text-4xl sm:text-5xl font-bold leading-none"
                  style={{ color: s.accent }}
                >
                  {s.value}
                </span>
                {s.unit && (
                  <span
                    className="text-lg font-semibold leading-none"
                    style={{ color: s.accent, opacity: 0.6 }}
                  >
                    {s.unit}
                  </span>
                )}
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

          {/* Upcoming / Getting started */}
          <div className="animate-fade-up-4">
            <h2 className="text-sm font-semibold uppercase tracking-widest mb-5" style={{ color: 'rgba(255,255,255,0.4)' }}>
              Upcoming
            </h2>
            <UpcomingMeetingsWidget fallback={quickStartPanel} />
          </div>
        </div>
      </div>
    </div>
  );
}
