'use client';

import Link from 'next/link';

interface Meeting {
  id: string;
  title: string;
  platform: string;
  status: string;
  created_at: string;
  duration: number | null;
  source_language: string | null;
  summary: string | null;
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
  if (isSameDay(date, now)) return `Today · ${time}`;
  if (isSameDay(date, yesterday)) return `Yesterday · ${time}`;
  return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) + ` · ${time}`;
}

const LANG_BADGE_MAP: Record<string, string> = {
  'hi-IN': 'Hindi', hi: 'Hindi',
  'ta-IN': 'Tamil', ta: 'Tamil',
  'te-IN': 'Telugu', te: 'Telugu',
  'kn-IN': 'Kannada', kn: 'Kannada',
  'ml-IN': 'Malayalam', ml: 'Malayalam',
  'mr-IN': 'Marathi', mr: 'Marathi',
  'bn-IN': 'Bengali', bn: 'Bengali',
  'gu-IN': 'Gujarati', gu: 'Gujarati',
  'pa-IN': 'Punjabi', pa: 'Punjabi',
  'od-IN': 'Odia', od: 'Odia',
  'en-IN': 'English', en: 'English',
};

function languageBadge(lang: string | null): string | null {
  if (!lang || lang === 'auto' || lang === 'unknown') return null;
  return LANG_BADGE_MAP[lang] ?? lang.split('-')[0].toUpperCase();
}

function extractOverview(summaryJson: string | null): string | null {
  if (!summaryJson) return null;
  try {
    const parsed = JSON.parse(summaryJson);
    return typeof parsed.overview === 'string' && parsed.overview.trim()
      ? parsed.overview.trim()
      : null;
  } catch { return null; }
}

function platformLabel(platform: string): string {
  if (platform === 'google_meet') return 'Meet';
  if (platform === 'zoom') return 'Zoom';
  return 'Other';
}

function statusConfig(status: string) {
  switch (status) {
    case 'completed': return { label: 'Completed', dot: '#34d399', color: 'rgba(52,211,153,0.8)' };
    case 'processing': return { label: 'Processing', dot: '#818cf8', color: 'rgba(129,140,248,0.8)', pulse: true };
    case 'recording': return { label: 'Recording', dot: '#f59e0b', color: 'rgba(245,158,11,0.8)', pulse: true };
    case 'failed': return { label: 'Failed', dot: '#fb7185', color: 'rgba(251,113,133,0.8)' };
    default: return { label: status.charAt(0).toUpperCase() + status.slice(1), dot: 'rgba(255,255,255,0.3)', color: 'rgba(255,255,255,0.35)' };
  }
}

function PlatformIcon({ platform }: { platform: string }) {
  if (platform === 'google_meet') {
    return (
      <div
        className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
        style={{ background: 'rgba(66,133,244,0.1)', border: '1px solid rgba(66,133,244,0.15)' }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
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
        className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
        style={{ background: 'rgba(43,134,255,0.1)', border: '1px solid rgba(43,134,255,0.15)' }}
      >
        <span className="font-bold text-sm" style={{ color: '#2b86ff' }}>Z</span>
      </div>
    );
  }
  return (
    <div
      className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
      style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
  const langLabel = languageBadge(meeting.source_language);
  const overview = extractOverview(meeting.summary);

  return (
    <Link href={`/meetings/${meeting.id}`}>
      <div
        className="group flex items-center justify-between gap-4 px-4 py-3.5 rounded-xl transition-all duration-200"
        style={{
          background: 'rgba(255,255,255,0.03)',
          border: '1px solid rgba(255,255,255,0.06)',
        }}
        onMouseEnter={(e) => {
          const el = e.currentTarget as HTMLElement;
          el.style.background = 'rgba(255,255,255,0.05)';
          el.style.borderColor = 'rgba(245,158,11,0.2)';
        }}
        onMouseLeave={(e) => {
          const el = e.currentTarget as HTMLElement;
          el.style.background = 'rgba(255,255,255,0.03)';
          el.style.borderColor = 'rgba(255,255,255,0.06)';
        }}
      >
        <div className="flex items-center gap-3.5 min-w-0">
          <PlatformIcon platform={meeting.platform} />
          <div className="min-w-0">
            <p className="font-medium text-sm truncate leading-snug" style={{ color: 'rgba(255,255,255,0.88)' }}>
              {meeting.title}
            </p>
            {overview && (
              <p className="text-[11px] mt-0.5 truncate font-light" style={{ color: 'rgba(255,255,255,0.5)' }}>
                {overview}
              </p>
            )}
            <p
              className="text-[11px] mt-1 truncate font-light"
              style={{ color: 'rgba(255,255,255,0.32)', fontFamily: 'ui-monospace, monospace', letterSpacing: '0.01em' }}
            >
              {platformLabel(meeting.platform)}
              {' · '}
              {formatDate(meeting.created_at)}
              {langLabel && ` · ${langLabel}`}
              {duration && ` · ${duration}`}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 flex-shrink-0">
          <span
            className="w-1.5 h-1.5 rounded-full flex-shrink-0"
            style={{
              background: status.dot,
              boxShadow: status.pulse ? `0 0 0 3px ${status.dot}33` : undefined,
            }}
          />
          <span className="text-xs font-medium" style={{ color: status.color }}>
            {status.label}
          </span>
        </div>
      </div>
    </Link>
  );
}
