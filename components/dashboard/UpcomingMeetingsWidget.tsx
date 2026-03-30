'use client';

import React, { useEffect, useState } from 'react';
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

interface UpcomingMeetingsWidgetProps {
  fallback?: React.ReactNode;
}

export function UpcomingMeetingsWidget({ fallback }: UpcomingMeetingsWidgetProps = {}) {
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
    return fallback ? <>{fallback}</> : null;
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
