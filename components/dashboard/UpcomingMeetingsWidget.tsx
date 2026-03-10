'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface CalendarMeeting {
  id: string;
  title: string;
  start: string | null;
  end: string | null;
  meetingUrl: string | null;
}

interface ApiResponse {
  meetings: CalendarMeeting[];
  connected: boolean;
  error?: string;
}

function formatTime(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleString('en-IN', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

export function UpcomingMeetingsWidget() {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/calendar/meetings')
      .then((r) => r.json())
      .then((d: ApiResponse) => setData(d))
      .catch(() => setData({ meetings: [], connected: false }))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-5 animate-pulse">
        <div className="h-4 bg-gray-100 rounded w-40 mb-3" />
        <div className="space-y-2">
          {[1, 2, 3].map((i) => <div key={i} className="h-12 bg-gray-50 rounded" />)}
        </div>
      </div>
    );
  }

  if (!data?.connected) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h2 className="text-sm font-semibold text-gray-900 mb-3">Upcoming meetings</h2>
        <div className="flex flex-col items-center py-6 text-center">
          <span className="text-3xl mb-2">📅</span>
          <p className="text-sm font-medium text-gray-700 mb-1">Connect Google Calendar</p>
          <p className="text-xs text-gray-400 mb-4">See upcoming meetings and let Basha auto-join</p>
          <a
            href={`/api/auth/signin/google?callbackUrl=${encodeURIComponent('/dashboard')}`}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold text-white"
            style={{ background: '#4285F4' }}
          >
            <GoogleIcon />
            Connect Google Calendar
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-gray-900">Upcoming meetings</h2>
        <span className="text-xs text-emerald-600 font-medium flex items-center gap-1">
          <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
          Calendar synced
        </span>
      </div>

      {data.meetings.length === 0 ? (
        <p className="text-xs text-gray-400 py-4 text-center">No meetings scheduled in the next 7 days</p>
      ) : (
        <ul className="space-y-2">
          {data.meetings.map((m) => (
            <li
              key={m.id}
              className="flex items-start justify-between gap-3 p-3 rounded-lg"
              style={{ background: '#f9fafb', border: '1px solid #f3f4f6' }}
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{m.title}</p>
                <p className="text-xs text-gray-400 mt-0.5">{formatTime(m.start)}</p>
              </div>
              {m.meetingUrl && (
                <Link
                  href={`/new-meeting?url=${encodeURIComponent(m.meetingUrl)}`}
                  className="flex-shrink-0 text-xs font-semibold px-3 py-1.5 rounded-lg"
                  style={{ background: '#f59e0b', color: '#07071a' }}
                >
                  Record
                </Link>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </svg>
  );
}
