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

interface CalendarApiResponse {
  meetings: CalendarMeeting[];
  connected: boolean;
  error?: string;
}

interface Intent {
  calendar_event_id: string;
  should_record: boolean;
  bot_launched: boolean;
  meeting_id: string | null;
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

/** Returns true if the event starts within the next `withinMinutes` minutes */
function startsWithin(iso: string | null, withinMinutes: number): boolean {
  if (!iso) return false;
  const diff = new Date(iso).getTime() - Date.now();
  return diff >= 0 && diff <= withinMinutes * 60 * 1000;
}

export function UpcomingMeetingsWidget() {
  const [calData, setCalData] = useState<CalendarApiResponse | null>(null);
  const [autoJoinAll, setAutoJoinAll] = useState(false);
  const [intents, setIntents] = useState<Record<string, Intent>>({});
  const [launching, setLaunching] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);

  // Fetch calendar events, user settings, and existing intents in parallel
  useEffect(() => {
    Promise.all([
      fetch('/api/calendar/meetings').then((r) => r.json() as Promise<CalendarApiResponse>),
      fetch('/api/user/settings').then((r) => r.json()),
      fetch('/api/calendar/intents').then((r) => r.json()),
    ])
      .then(([cal, settings, intentData]) => {
        setCalData(cal);
        setAutoJoinAll(settings.auto_join_all ?? false);
        const intentMap: Record<string, Intent> = {};
        for (const intent of intentData.intents ?? []) {
          intentMap[intent.calendar_event_id] = intent;
        }
        setIntents(intentMap);
      })
      .catch(() => setCalData({ meetings: [], connected: false }))
      .finally(() => setLoading(false));
  }, []);

  // Auto-launch bots for events starting within 5 minutes when auto-join is on
  useEffect(() => {
    if (!calData?.meetings) return;
    for (const meeting of calData.meetings) {
      if (!meeting.meetingUrl) continue;
      const intent = intents[meeting.id];
      const shouldAutoLaunch =
        (autoJoinAll || intent?.should_record) &&
        !intent?.bot_launched &&
        !launching[meeting.id] &&
        startsWithin(meeting.start, 5);

      if (shouldAutoLaunch) {
        launchBot(meeting.id, meeting.meetingUrl, meeting.title, meeting.start);
      }
    }
  }, [calData, autoJoinAll, intents]); // eslint-disable-line react-hooks/exhaustive-deps

  async function toggleAutoJoinAll(value: boolean) {
    setAutoJoinAll(value);
    await fetch('/api/user/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ auto_join_all: value }),
    });
  }

  async function toggleEventIntent(meeting: CalendarMeeting, shouldRecord: boolean) {
    if (!meeting.meetingUrl) return;
    setIntents((prev) => ({
      ...prev,
      [meeting.id]: {
        ...(prev[meeting.id] ?? { bot_launched: false, meeting_id: null }),
        calendar_event_id: meeting.id,
        should_record: shouldRecord,
      },
    }));
    await fetch('/api/calendar/intents', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        calendarEventId: meeting.id,
        meetingUrl: meeting.meetingUrl,
        scheduledStart: meeting.start,
        shouldRecord,
      }),
    });
  }

  async function launchBot(
    eventId: string,
    meetingUrl: string,
    title: string | null,
    scheduledStart: string | null
  ) {
    setLaunching((prev) => ({ ...prev, [eventId]: true }));
    try {
      const res = await fetch('/api/bots', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ meetingUrl, title: title ?? 'Calendar Meeting' }),
      });
      if (!res.ok) return;
      const data = await res.json();

      // Mark intent as launched
      setIntents((prev) => ({
        ...prev,
        [eventId]: {
          ...(prev[eventId] ?? { should_record: true, calendar_event_id: eventId }),
          bot_launched: true,
          meeting_id: data.meetingId,
        },
      }));
      await fetch('/api/calendar/intents', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          calendarEventId: eventId,
          botLaunched: true,
          meetingId: data.meetingId,
        }),
      });
      // Also ensure the intent row exists (upsert first if needed)
      if (!intents[eventId]) {
        await fetch('/api/calendar/intents', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            calendarEventId: eventId,
            meetingUrl,
            scheduledStart,
            shouldRecord: true,
          }),
        });
      }
    } finally {
      setLaunching((prev) => ({ ...prev, [eventId]: false }));
    }
  }

  // ── Loading skeleton ─────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-5 animate-pulse">
        <div className="h-4 bg-gray-100 rounded w-40 mb-3" />
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-12 bg-gray-50 rounded" />
          ))}
        </div>
      </div>
    );
  }

  // ── Calendar not connected ────────────────────────────────────────────────────
  if (!calData?.connected) {
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

  // ── Main widget ───────────────────────────────────────────────────────────────
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      {/* Header row */}
      <div className="flex items-center justify-between mb-1">
        <h2 className="text-sm font-semibold text-gray-900">Upcoming meetings</h2>
        <span className="text-xs text-emerald-600 font-medium flex items-center gap-1">
          <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
          Calendar synced
        </span>
      </div>

      {/* Auto-join all toggle */}
      <div className="flex items-center justify-between py-2 mb-3 border-b border-gray-100">
        <div>
          <p className="text-xs font-medium text-gray-700">Auto-join all meetings</p>
          <p className="text-xs text-gray-400">Basha joins 5 min before each event</p>
        </div>
        <button
          type="button"
          onClick={() => toggleAutoJoinAll(!autoJoinAll)}
          className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none ${
            autoJoinAll ? 'bg-indigo-600' : 'bg-gray-200'
          }`}
          role="switch"
          aria-checked={autoJoinAll}
        >
          <span
            className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ${
              autoJoinAll ? 'translate-x-4' : 'translate-x-0'
            }`}
          />
        </button>
      </div>

      {calData.meetings.length === 0 ? (
        <p className="text-xs text-gray-400 py-4 text-center">
          No meetings scheduled in the next 7 days
        </p>
      ) : (
        <ul className="space-y-2">
          {calData.meetings.map((m) => {
            const intent = intents[m.id];
            const isRecording = autoJoinAll || intent?.should_record;
            const isLaunched = intent?.bot_launched;
            const isLaunching = launching[m.id];
            const imminent = startsWithin(m.start, 5);

            return (
              <li
                key={m.id}
                className="p-3 rounded-lg"
                style={{ background: '#f9fafb', border: '1px solid #f3f4f6' }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{m.title}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{formatTime(m.start)}</p>
                    {isLaunched && intent?.meeting_id && (
                      <Link
                        href={`/meetings/${intent.meeting_id}`}
                        className="text-xs text-indigo-600 font-medium mt-1 inline-block hover:underline"
                      >
                        View meeting →
                      </Link>
                    )}
                  </div>

                  <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                    {/* Bot status / launch button */}
                    {isLaunched ? (
                      <span className="text-xs font-medium px-2 py-1 rounded-md bg-emerald-50 text-emerald-700">
                        Bot joined
                      </span>
                    ) : isLaunching ? (
                      <span className="text-xs font-medium px-2 py-1 rounded-md bg-indigo-50 text-indigo-600 animate-pulse">
                        Launching…
                      </span>
                    ) : imminent && isRecording && m.meetingUrl ? (
                      <button
                        type="button"
                        onClick={() => launchBot(m.id, m.meetingUrl!, m.title, m.start)}
                        className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-amber-400 text-gray-900 hover:bg-amber-500 transition-colors"
                      >
                        Launch now
                      </button>
                    ) : m.meetingUrl && !autoJoinAll ? (
                      <Link
                        href={`/new-meeting?url=${encodeURIComponent(m.meetingUrl)}`}
                        className="text-xs font-semibold px-3 py-1.5 rounded-lg"
                        style={{ background: '#f59e0b', color: '#07071a' }}
                      >
                        Record
                      </Link>
                    ) : null}

                    {/* Per-event record toggle (only when auto-join-all is off) */}
                    {m.meetingUrl && !autoJoinAll && !isLaunched && (
                      <button
                        type="button"
                        onClick={() => toggleEventIntent(m, !intent?.should_record)}
                        className={`text-xs px-2 py-0.5 rounded-full border transition-colors ${
                          intent?.should_record
                            ? 'border-indigo-300 text-indigo-700 bg-indigo-50'
                            : 'border-gray-200 text-gray-400 bg-white hover:border-indigo-200'
                        }`}
                      >
                        {intent?.should_record ? 'Will record' : 'Record?'}
                      </button>
                    )}

                    {/* Auto-join badge */}
                    {autoJoinAll && !isLaunched && m.meetingUrl && (
                      <span className="text-xs text-indigo-500 font-medium">Auto-join on</span>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
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
