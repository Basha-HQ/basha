'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';

type MeetingStatus = 'recording' | 'processing' | 'completed' | 'failed' | 'pending';

interface StatusData {
  status: MeetingStatus;
  title: string;
}

const STEPS: { key: MeetingStatus | 'uploading'; label: string; icon: string }[] = [
  { key: 'recording', label: 'Recording', icon: '🔴' },
  { key: 'uploading', label: 'Uploading audio', icon: '📤' },
  { key: 'processing', label: 'Transcribing', icon: '🧠' },
  { key: 'completed', label: 'Done', icon: '✅' },
];

function stepIndex(status: MeetingStatus | 'uploading') {
  return STEPS.findIndex((s) => s.key === status);
}

interface Props {
  meetingId: string;
  /** Called when the user explicitly cancels (before completion) */
  onCancel?: () => void;
}

export default function ExtensionStatusCard({ meetingId, onCancel }: Props) {
  const router = useRouter();
  const [data, setData] = useState<StatusData | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [startTime] = useState(Date.now());

  const poll = useCallback(async () => {
    try {
      const res = await fetch(`/api/meetings/${meetingId}`);
      if (!res.ok) return;
      const json = await res.json();
      setData({ status: json.status, title: json.title });
      if (json.status === 'completed') {
        router.push(`/meetings/${meetingId}`);
      }
    } catch {
      // ignore transient errors
    }
  }, [meetingId, router]);

  // Poll every 5 seconds
  useEffect(() => {
    poll();
    const interval = setInterval(poll, 5000);
    return () => clearInterval(interval);
  }, [poll]);

  // Elapsed timer while processing
  useEffect(() => {
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [startTime]);

  const status = data?.status ?? 'processing';
  const currentStepIdx = stepIndex(status === 'completed' ? 'completed' : status);

  const formatTime = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

  if (status === 'failed') {
    return (
      <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-5 space-y-3">
        <p className="font-semibold text-red-400">Processing failed</p>
        <p className="text-sm text-slate-400">
          Something went wrong while transcribing your meeting. You can try again from the meetings page.
        </p>
        <button
          onClick={() => router.push('/meetings')}
          className="text-sm text-indigo-400 hover:text-indigo-300 underline cursor-pointer"
        >
          Go to meetings
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-indigo-500/20 bg-slate-800/50 p-5 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="font-semibold text-white text-sm">
            {data?.title ?? 'Processing your meeting…'}
          </p>
          <p className="text-xs text-slate-500 mt-0.5">{formatTime(elapsed)} elapsed</p>
        </div>
        {status !== 'completed' && onCancel && (
          <button
            onClick={onCancel}
            className="text-xs text-slate-600 hover:text-slate-400 cursor-pointer transition-colors"
          >
            Cancel
          </button>
        )}
      </div>

      {/* Progress steps */}
      <div className="space-y-2">
        {STEPS.map((step, idx) => {
          const isDone = idx < currentStepIdx;
          const isActive = idx === currentStepIdx;
          return (
            <div key={step.key} className="flex items-center gap-3">
              <div
                className={`w-6 h-6 rounded-full flex items-center justify-center text-xs shrink-0 ${
                  isDone
                    ? 'bg-indigo-600 text-white'
                    : isActive
                    ? 'bg-indigo-600/30 border border-indigo-500 text-indigo-300'
                    : 'bg-slate-700 text-slate-500'
                }`}
              >
                {isDone ? '✓' : step.icon}
              </div>
              <span
                className={`text-sm ${
                  isDone
                    ? 'text-slate-400 line-through'
                    : isActive
                    ? 'text-white font-medium'
                    : 'text-slate-600'
                }`}
              >
                {step.label}
                {isActive && (
                  <span className="inline-block ml-2 animate-pulse text-indigo-400">…</span>
                )}
              </span>
            </div>
          );
        })}
      </div>

      <p className="text-xs text-slate-600 text-center">
        Sarvam AI is processing your Hinglish / Tanglish recording
      </p>
    </div>
  );
}
