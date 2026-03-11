'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

interface Props {
  botId: string;
  meetingStatus: string;
}

/**
 * Invisible component that polls GET /api/bots/:id while a meeting is still
 * in 'recording' or 'processing' state. This ensures that if the user navigated
 * away from the BotStatusCard, Recall.ai's finished recording still triggers
 * the processing pipeline and eventually redirects to the completed meeting.
 */
export function MeetingStatusPoller({ botId, meetingStatus }: Props) {
  const router = useRouter();
  const [label, setLabel] = useState('Checking for recording…');

  useEffect(() => {
    if (!['recording', 'processing'].includes(meetingStatus)) return;

    let stopped = false;

    async function poll() {
      while (!stopped) {
        try {
          const res = await fetch(`/api/bots/${botId}`);
          if (res.ok) {
            const data = await res.json();
            const status: string = data.bot?.status;

            if (status === 'completed') {
              router.refresh();
              return;
            }
            if (status === 'processing') {
              setLabel('Transcribing and translating…');
            } else if (status === 'failed') {
              router.refresh();
              return;
            } else {
              setLabel('Waiting for Recall.ai to finish…');
            }
          }
        } catch {
          // Network error — keep polling
        }
        await new Promise((r) => setTimeout(r, 5000));
      }
    }

    poll();
    return () => { stopped = true; };
  }, [botId, meetingStatus, router]);

  return (
    <p className="text-xs mt-2" style={{ color: 'rgba(255,255,255,0.3)' }}>
      {label} · Page will update automatically
    </p>
  );
}
