'use client';

import Link from 'next/link';

interface Meeting {
  id: string;
  title: string;
  platform: string;
  status: string;
  created_at: string;
  duration: number | null;
}

function formatDuration(seconds: number | null): string {
  if (!seconds) return '';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m ${s}s`;
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const isSameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  const time = date.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true });
  if (isSameDay(date, now)) return `Today at ${time}`;
  if (isSameDay(date, yesterday)) return `Yesterday at ${time}`;
  return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) + ` at ${time}`;
}

function platformLabel(platform: string): string {
  if (platform === 'google_meet') return 'Google Meet';
  if (platform === 'zoom') return 'Zoom';
  return 'Other';
}

function statusConfig(status: string) {
  switch (status) {
    case 'completed': return { label: 'Completed', color: '#34d399', bg: 'rgba(52,211,153,0.1)', border: 'rgba(52,211,153,0.2)' };
    case 'processing': return { label: 'Processing', color: '#6366f1', bg: 'rgba(99,102,241,0.12)', border: 'rgba(99,102,241,0.25)' };
    case 'recording': return { label: 'Recording', color: '#f59e0b', bg: 'rgba(245,158,11,0.1)', border: 'rgba(245,158,11,0.2)' };
    case 'failed': return { label: 'Failed', color: '#fb7185', bg: 'rgba(251,113,133,0.1)', border: 'rgba(251,113,133,0.2)' };
    default: return { label: status.charAt(0).toUpperCase() + status.slice(1), color: 'rgba(255,255,255,0.4)', bg: 'rgba(255,255,255,0.05)', border: 'rgba(255,255,255,0.1)' };
  }
}

function PlatformIcon({ platform }: { platform: string }) {
  if (platform === 'google_meet') {
    return (
      <div
        className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center flex-shrink-0"
        style={{ background: 'rgba(66,133,244,0.12)', border: '1px solid rgba(66,133,244,0.2)' }}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
          <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
          <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
          <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
          <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
        </svg>
      </div>
    );
  }
  if (platform === 'zoom') {
    return (
      <div
        className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center flex-shrink-0"
        style={{ background: 'rgba(43,134,255,0.12)', border: '1px solid rgba(43,134,255,0.2)' }}
      >
        <span className="font-bold text-sm" style={{ color: '#2b86ff' }}>Z</span>
      </div>
    );
  }
  return (
    <div
      className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center flex-shrink-0"
      style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
        <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
        <line x1="12" y1="19" x2="12" y2="23" />
        <line x1="8" y1="23" x2="16" y2="23" />
      </svg>
    </div>
  );
}

export function MeetingCard({ meeting }: { meeting: Meeting }) {
  const status = statusConfig(meeting.status);
  const duration = formatDuration(meeting.duration);

  return (
    <Link href={`/meetings/${meeting.id}`}>
      <div
        className="group rounded-2xl p-3.5 sm:p-4 flex items-center justify-between gap-3 transition-all duration-200"
        style={{
          background: 'rgba(255,255,255,0.03)',
          border: '1px solid rgba(255,255,255,0.07)',
        }}
        onMouseEnter={(e) => {
          const el = e.currentTarget as HTMLElement;
          el.style.background = 'rgba(255,255,255,0.05)';
          el.style.borderColor = 'rgba(245,158,11,0.25)';
          el.style.transform = 'translateY(-1px)';
          el.style.boxShadow = '0 4px 24px rgba(0,0,0,0.3)';
        }}
        onMouseLeave={(e) => {
          const el = e.currentTarget as HTMLElement;
          el.style.background = 'rgba(255,255,255,0.03)';
          el.style.borderColor = 'rgba(255,255,255,0.07)';
          el.style.transform = 'translateY(0)';
          el.style.boxShadow = 'none';
        }}
      >
        <div className="flex items-center gap-3 min-w-0">
          <PlatformIcon platform={meeting.platform} />
          <div className="min-w-0">
            <p className="font-semibold text-sm sm:text-base truncate" style={{ color: 'rgba(255,255,255,0.85)' }}>
              {meeting.title}
            </p>
            <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.35)' }}>
              {platformLabel(meeting.platform)}
              <span className="mx-1.5" style={{ color: 'rgba(255,255,255,0.15)' }}>·</span>
              {formatDate(meeting.created_at)}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
          {duration && (
            <span
              className="hidden sm:inline-flex text-xs font-medium px-2 py-1 rounded-lg"
              style={{ color: 'rgba(255,255,255,0.35)', background: 'rgba(255,255,255,0.05)' }}
            >
              {duration}
            </span>
          )}
          <span
            className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-semibold"
            style={{ color: status.color, background: status.bg, border: `1px solid ${status.border}` }}
          >
            {status.label}
          </span>
        </div>
      </div>
    </Link>
  );
}
