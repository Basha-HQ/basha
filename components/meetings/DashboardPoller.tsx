'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface Meeting {
  id: string;
  title: string;
  status: string;
}

interface Props {
  recentMeetings: Meeting[];
}

/**
 * Polls GET /api/meetings every 10 seconds while any recent meeting is in
 * 'recording' or 'processing'. When one completes, refreshes the server
 * component and shows a brief toast linking to the finished meeting.
 */
export function DashboardPoller({ recentMeetings }: Props) {
  const router = useRouter();
  const [toast, setToast] = useState<{ title: string; id: string } | null>(null);
  const prevStatuses = useRef<Record<string, string>>(
    Object.fromEntries(recentMeetings.map((m) => [m.id, m.status]))
  );

  useEffect(() => {
    const hasActive = recentMeetings.some((m) =>
      m.status === 'recording' || m.status === 'processing'
    );
    if (!hasActive) return;

    let stopped = false;

    async function poll() {
      while (!stopped) {
        await new Promise((r) => setTimeout(r, 10_000));
        if (stopped) return;

        try {
          const res = await fetch('/api/meetings');
          if (!res.ok || stopped) continue;

          const data: { meetings: Array<{ id: string; title: string; status: string }> } =
            await res.json();

          let anyActive = false;
          let refreshNeeded = false;

          for (const m of data.meetings) {
            const prev = prevStatuses.current[m.id];
            if (prev === undefined) continue;

            if (prev !== m.status) {
              prevStatuses.current[m.id] = m.status;
              refreshNeeded = true;

              if (m.status === 'completed') {
                setToast({ title: m.title, id: m.id });
                setTimeout(() => setToast(null), 8000);
              }
            }

            if (m.status === 'recording' || m.status === 'processing') {
              anyActive = true;
            }
          }

          if (refreshNeeded) router.refresh();
          if (!anyActive) return;
        } catch {
          // Network error — keep polling
        }
      }
    }

    poll();
    return () => { stopped = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!toast) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-6 right-6 z-50 flex items-center gap-3 px-4 py-3 rounded-xl shadow-xl animate-fade-up-1"
      style={{
        background: 'rgba(16, 16, 40, 0.95)',
        border: '1px solid rgba(52,211,153,0.35)',
        backdropFilter: 'blur(12px)',
        maxWidth: '380px',
      }}
    >
      <div
        className="w-2 h-2 rounded-full flex-shrink-0"
        style={{ background: '#34d399', boxShadow: '0 0 6px #34d399' }}
        aria-hidden="true"
      />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold truncate" style={{ color: 'rgba(255,255,255,0.9)' }}>
          Transcript ready
        </p>
        <p className="text-xs truncate mt-0.5" style={{ color: 'rgba(255,255,255,0.45)' }}>
          {toast.title}
        </p>
      </div>
      <Link
        href={`/meetings/${toast.id}`}
        className="inline-flex items-center justify-center text-xs font-semibold whitespace-nowrap rounded-lg transition-all hover:opacity-90"
        style={{
          color: '#0a0a0f',
          background: '#f59e0b',
          padding: '10px 14px',
          minHeight: '44px',
        }}
        onClick={() => setToast(null)}
      >
        Open transcript
      </Link>
      <button
        onClick={() => setToast(null)}
        className="hover:opacity-60 transition-opacity flex-shrink-0 flex items-center justify-center"
        style={{
          color: 'rgba(255,255,255,0.4)',
          width: '32px',
          height: '32px',
          marginLeft: '-2px',
        }}
        aria-label="Dismiss notification"
      >
        ✕
      </button>
    </div>
  );
}
