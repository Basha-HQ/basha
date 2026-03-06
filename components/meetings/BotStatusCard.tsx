'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardBody } from '@/components/ui/Card';
import { Bot, BotStatus, BOT_STATUS_LABEL, isBotActive } from '@/lib/bot/types';

const STATUS_ICON: Record<BotStatus, string> = {
  idle: '🤖',
  joining: '🚪',
  in_meeting: '👥',
  recording: '🔴',
  leaving: '🚶',
  processing: '🧠',
  completed: '✅',
  failed: '❌',
};

const STATUS_COLOR: Record<BotStatus, string> = {
  idle: 'text-gray-500',
  joining: 'text-blue-500',
  in_meeting: 'text-indigo-600',
  recording: 'text-red-500',
  leaving: 'text-orange-500',
  processing: 'text-purple-500',
  completed: 'text-green-600',
  failed: 'text-red-600',
};

interface Props {
  botId: string;
  meetingId: string;
}

export function BotStatusCard({ botId, meetingId }: Props) {
  const router = useRouter();
  const [bot, setBot] = useState<Bot | null>(null);
  const [stopping, setStopping] = useState(false);

  useEffect(() => {
    let stopped = false;

    async function poll() {
      while (!stopped) {
        try {
          const res = await fetch(`/api/bots/${botId}`);
          if (res.ok) {
            const data = await res.json();
            setBot(data.bot);

            // Redirect to meeting detail when done
            if (data.bot.status === 'completed') {
              router.push(`/meetings/${meetingId}`);
              return;
            }

            if (data.bot.status === 'failed') {
              return; // Stop polling
            }
          }
        } catch {
          // Network error — keep polling
        }

        await new Promise(r => setTimeout(r, 3000));
      }
    }

    poll();
    return () => { stopped = true; };
  }, [botId, meetingId, router]);

  async function stopBot() {
    setStopping(true);
    await fetch(`/api/bots/${botId}`, { method: 'DELETE' });
    setStopping(false);
    router.push('/dashboard');
  }

  const status: BotStatus = (bot?.status as BotStatus) ?? 'idle';
  const active = isBotActive(status);

  return (
    <Card>
      <CardBody className="py-10 text-center">
        {/* Icon */}
        <div className={`text-5xl mb-4 ${active ? 'animate-pulse' : ''}`}>
          {STATUS_ICON[status]}
        </div>

        {/* Status label */}
        <h2 className={`text-lg font-semibold mb-1 ${STATUS_COLOR[status]}`}>
          {BOT_STATUS_LABEL[status]}
        </h2>

        {bot?.error && (
          <p className="text-sm text-red-500 mt-2 bg-red-50 px-3 py-2 rounded-lg">
            {bot.error}
          </p>
        )}

        {/* Progress steps */}
        <div className="mt-6 flex items-center justify-center gap-1">
          {(['joining', 'in_meeting', 'recording', 'processing', 'completed'] as BotStatus[]).map(
            (s, i, arr) => {
              const steps: BotStatus[] = ['idle', 'joining', 'in_meeting', 'recording', 'leaving', 'processing', 'completed'];
              const currentIdx = steps.indexOf(status);
              const stepIdx = steps.indexOf(s);
              const done = currentIdx > stepIdx;
              const current = s === status;

              return (
                <div key={s} className="flex items-center gap-1">
                  <div
                    className={`w-2.5 h-2.5 rounded-full transition-colors ${
                      done
                        ? 'bg-indigo-500'
                        : current
                        ? 'bg-indigo-400 animate-pulse'
                        : 'bg-gray-200'
                    }`}
                  />
                  {i < arr.length - 1 && (
                    <div className={`w-6 h-0.5 ${done ? 'bg-indigo-400' : 'bg-gray-200'}`} />
                  )}
                </div>
              );
            }
          )}
        </div>

        <p className="text-xs text-gray-400 mt-4">
          {active
            ? 'This page refreshes automatically'
            : status === 'failed'
            ? 'Bot encountered an error'
            : 'Redirecting to meeting…'}
        </p>

        {/* Stop button (only while active) */}
        {active && status !== 'processing' && (
          <button
            onClick={stopBot}
            disabled={stopping}
            className="mt-6 text-sm text-red-500 hover:underline disabled:opacity-50"
          >
            {stopping ? 'Stopping…' : 'Stop bot'}
          </button>
        )}
      </CardBody>
    </Card>
  );
}
