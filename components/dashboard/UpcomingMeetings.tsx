'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface CalendarEvent {
  id: string;
  title: string;
  start: string | null;
  end: string | null;
  meetingUrl: string | null;
}

interface Intent {
  id: string;
  calendar_event_id: string;
  meeting_url: string;
  scheduled_start: string | null;
  should_record: boolean;
  bot_launched: boolean;
  meeting_id: string | null;
}

interface Row {
  event: CalendarEvent;
  intent: Intent | null;
  platform: 'google_meet' | 'zoom' | 'teams' | 'other';
  startsInMinutes: number;
}

function detectPlatform(url: string): Row['platform'] {
  if (url.includes('meet.google.com')) return 'google_meet';
  if (url.includes('zoom.us')) return 'zoom';
  if (url.includes('teams.microsoft.com') || url.includes('teams.live.com')) return 'teams';
  return 'other';
}

function platformLabel(p: Row['platform']): string {
  if (p === 'google_meet') return 'Meet';
  if (p === 'zoom') return 'Zoom';
  if (p === 'teams') return 'Teams';
  return 'Other';
}

function formatStart(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  const today = new Date();
  const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const sameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

  const time = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  if (sameDay(d, today)) return `Today, ${time}`;
  if (sameDay(d, tomorrow)) return `Tomorrow, ${time}`;
  return d.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' }) + `, ${time}`;
}

function statusBadge(row: Row): { label: string; color: string; bg: string } {
  if (row.intent?.meeting_id && row.intent.bot_launched) {
    return { label: '🟢 Recording', color: '#34d399', bg: 'rgba(52,211,153,0.12)' };
  }
  if (row.startsInMinutes <= 0 && row.startsInMinutes > -120) {
    return { label: '⏱  In progress', color: '#f59e0b', bg: 'rgba(245,158,11,0.1)' };
  }
  if (row.startsInMinutes < 5 && row.intent?.should_record) {
    return { label: `Joining in ${Math.max(0, Math.ceil(row.startsInMinutes))}m`, color: '#a78bfa', bg: 'rgba(167,139,250,0.1)' };
  }
  if (row.intent?.should_record) {
    return { label: 'Will record', color: '#f59e0b', bg: 'rgba(245,158,11,0.08)' };
  }
  return { label: 'Off', color: 'rgba(255,255,255,0.4)', bg: 'rgba(255,255,255,0.04)' };
}

export function UpcomingMeetings({ calendarConnected }: { calendarConnected: boolean }) {
  const [loading, setLoading] = useState(calendarConnected);
  const [rows, setRows] = useState<Row[]>([]);

  useEffect(() => {
    if (!calendarConnected) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    async function load() {
      try {
        const [evRes, intRes] = await Promise.all([
          fetch('/api/calendar/meetings'),
          fetch('/api/calendar/intents'),
        ]);
        const evData = await evRes.json();
        const intData = await intRes.json();
        if (cancelled) return;

        const events: CalendarEvent[] = evData.meetings ?? [];
        const intentByEvent: Record<string, Intent> = {};
        for (const i of (intData.intents ?? []) as Intent[]) {
          intentByEvent[i.calendar_event_id] = i;
        }

        const now = Date.now();
        const next: Row[] = events
          .filter((e) => e.meetingUrl && e.start)
          .map((e) => {
            const url = e.meetingUrl!;
            const startMs = e.start ? new Date(e.start).getTime() : 0;
            const minutes = (startMs - now) / 60_000;
            return {
              event: e,
              intent: intentByEvent[e.id] ?? null,
              platform: detectPlatform(url),
              startsInMinutes: minutes,
            };
          });

        setRows(next);
        setLoading(false);
      } catch {
        setLoading(false);
      }
    }
    load();
    const id = setInterval(load, 60_000); // refresh once a minute
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [calendarConnected]);

  async function toggleRecord(row: Row) {
    const next = !(row.intent?.should_record ?? false);
    // Optimistic update
    setRows((prev) =>
      prev.map((r) =>
        r.event.id === row.event.id
          ? {
              ...r,
              intent: {
                id: r.intent?.id ?? '',
                calendar_event_id: r.event.id,
                meeting_url: r.event.meetingUrl ?? '',
                scheduled_start: r.event.start ?? null,
                should_record: next,
                bot_launched: r.intent?.bot_launched ?? false,
                meeting_id: r.intent?.meeting_id ?? null,
              },
            }
          : r
      )
    );

    try {
      await fetch('/api/calendar/intents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          calendarEventId: row.event.id,
          meetingUrl: row.event.meetingUrl,
          scheduledStart: row.event.start,
          shouldRecord: next,
        }),
      });
    } catch {
      // Revert on failure (rare)
      setRows((prev) =>
        prev.map((r) =>
          r.event.id === row.event.id
            ? { ...r, intent: r.intent ? { ...r.intent, should_record: !next } : null }
            : r
        )
      );
    }
  }

  if (!calendarConnected) {
    return (
      <div
        className="rounded-xl p-6"
        style={{ background: 'rgba(255,255,255,0.02)', border: '1px dashed rgba(255,255,255,0.08)' }}
      >
        <h3 className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: 'rgba(255,255,255,0.3)' }}>
          Upcoming meetings
        </h3>
        <p className="text-sm" style={{ color: 'rgba(255,255,255,0.6)' }}>
          Connect Google Calendar to see your upcoming meetings here. The notetaker can auto-join them based on your settings.
        </p>
        <Link
          href="/settings"
          className="inline-block mt-4 text-xs font-semibold hover:opacity-80 transition-opacity"
          style={{ color: '#f59e0b' }}
        >
          Connect Calendar →
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.4)' }}>
          Upcoming meetings
        </h3>
        <Link
          href="/settings"
          className="text-xs font-medium transition-opacity hover:opacity-70"
          style={{ color: 'rgba(255,255,255,0.4)' }}
        >
          Settings
        </Link>
      </div>

      {loading ? (
        <div
          className="rounded-xl p-6"
          style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}
        >
          <p className="text-sm" style={{ color: 'rgba(255,255,255,0.35)' }}>Loading…</p>
        </div>
      ) : rows.length === 0 ? (
        <div
          className="rounded-xl p-6 text-center"
          style={{ background: 'rgba(255,255,255,0.02)', border: '1px dashed rgba(255,255,255,0.08)' }}
        >
          <p className="text-sm" style={{ color: 'rgba(255,255,255,0.55)' }}>
            No upcoming meetings on your calendar.
          </p>
          <p className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.32)' }}>
            Or paste a link to record an ad-hoc call.
          </p>
          <Link
            href="/new-meeting"
            className="inline-block mt-3 text-xs font-semibold hover:opacity-80 transition-opacity"
            style={{ color: '#f59e0b' }}
          >
            Start ad-hoc recording →
          </Link>
        </div>
      ) : (
        <div className="space-y-1.5">
          {rows.map((row) => {
            const badge = statusBadge(row);
            const isOn = row.intent?.should_record ?? false;
            const launched = row.intent?.bot_launched ?? false;
            return (
              <div
                key={row.event.id}
                className="rounded-xl p-4 flex items-center gap-3 transition-colors"
                style={{
                  background: 'rgba(255,255,255,0.02)',
                  border: '1px solid rgba(255,255,255,0.06)',
                }}
              >
                {/* Toggle */}
                <button
                  onClick={() => !launched && toggleRecord(row)}
                  disabled={launched}
                  className="flex-shrink-0 transition-colors"
                  style={{
                    width: 36, height: 20, borderRadius: 99,
                    background: isOn ? 'rgba(245,158,11,0.5)' : 'rgba(255,255,255,0.08)',
                    border: isOn ? '1px solid rgba(245,158,11,0.7)' : '1px solid rgba(255,255,255,0.12)',
                    position: 'relative',
                    cursor: launched ? 'not-allowed' : 'pointer',
                    opacity: launched ? 0.6 : 1,
                  }}
                  title={launched ? 'Bot already launched' : isOn ? 'Notetaker will join' : 'Notetaker will not join'}
                >
                  <div
                    style={{
                      position: 'absolute',
                      top: 1, left: isOn ? 17 : 1,
                      width: 16, height: 16, borderRadius: 99,
                      background: isOn ? '#f59e0b' : 'rgba(255,255,255,0.5)',
                      transition: 'left 0.15s',
                    }}
                  />
                </button>

                {/* Title + start */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate" style={{ color: 'rgba(255,255,255,0.88)' }}>
                    {row.event.title}
                  </p>
                  <p className="text-xs mt-0.5 flex items-center gap-2" style={{ color: 'rgba(255,255,255,0.4)' }}>
                    <span>{formatStart(row.event.start)}</span>
                    <span>·</span>
                    <span
                      className="px-1.5 py-0.5 rounded text-[10px] font-semibold"
                      style={{ background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.55)' }}
                    >
                      {platformLabel(row.platform)}
                    </span>
                  </p>
                </div>

                {/* Status badge / link */}
                {row.intent?.meeting_id ? (
                  <Link
                    href={`/meetings/${row.intent.meeting_id}`}
                    className="text-xs font-semibold px-2.5 py-1 rounded-md hover:opacity-80 transition-opacity"
                    style={{ color: badge.color, background: badge.bg }}
                  >
                    {badge.label}
                  </Link>
                ) : (
                  <span
                    className="text-xs font-semibold px-2.5 py-1 rounded-md"
                    style={{ color: badge.color, background: badge.bg }}
                  >
                    {badge.label}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
