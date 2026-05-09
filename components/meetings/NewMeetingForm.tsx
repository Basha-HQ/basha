'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

const PLATFORM_HINTS = [
  { match: 'meet.google.com', label: 'Google Meet' },
  { match: 'zoom.us',         label: 'Zoom' },
  { match: 'teams.microsoft.com', label: 'Microsoft Teams' },
  { match: 'teams.live.com',  label: 'Microsoft Teams' },
];

function detectPlatform(url: string): string | null {
  for (const p of PLATFORM_HINTS) if (url.includes(p.match)) return p.label;
  return null;
}

function isValidMeetingUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return PLATFORM_HINTS.some((p) => u.hostname.includes(p.match.split('/')[0]));
  } catch {
    return false;
  }
}

export function NewMeetingForm() {
  const router = useRouter();
  const [meetingUrl, setMeetingUrl] = useState('');
  const [title, setTitle] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const platform = meetingUrl.trim() ? detectPlatform(meetingUrl.trim()) : null;
  const isValid = meetingUrl.trim() ? isValidMeetingUrl(meetingUrl.trim()) : false;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isValid || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/bots', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          meetingUrl: meetingUrl.trim(),
          title: title.trim() || undefined,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `Server returned ${res.status}`);
      }
      const data = await res.json();
      router.push(`/meetings/${data.meetingId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not start the notetaker');
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={onSubmit}
      className="rounded-2xl overflow-hidden"
      style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}
    >
      <div className="p-5 sm:p-6 space-y-5">
        {/* URL input */}
        <div>
          <label
            className="block text-xs font-semibold uppercase tracking-widest mb-2"
            style={{ color: 'rgba(255,255,255,0.45)' }}
          >
            Meeting URL
          </label>
          <input
            type="url"
            inputMode="url"
            autoComplete="off"
            placeholder="https://meet.google.com/abc-defg-hij"
            value={meetingUrl}
            onChange={(e) => setMeetingUrl(e.target.value)}
            className="w-full px-3 py-2.5 rounded-lg text-sm outline-none transition-colors"
            style={{
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.08)',
              color: 'rgba(255,255,255,0.92)',
            }}
            autoFocus
          />
          <p className="text-xs mt-2" style={{ color: 'rgba(255,255,255,0.35)' }}>
            Paste a Google Meet, Zoom, or Microsoft Teams link.
            {platform && (
              <span style={{ color: '#34d399', marginLeft: 6 }}>· Detected: {platform}</span>
            )}
            {meetingUrl.trim() && !isValid && (
              <span style={{ color: '#fb7185', marginLeft: 6 }}>· Not a recognised meeting link</span>
            )}
          </p>
        </div>

        {/* Title (optional) */}
        <div>
          <label
            className="block text-xs font-semibold uppercase tracking-widest mb-2"
            style={{ color: 'rgba(255,255,255,0.45)' }}
          >
            Title <span style={{ color: 'rgba(255,255,255,0.3)' }}>· optional</span>
          </label>
          <input
            type="text"
            placeholder="Q3 Roadmap"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full px-3 py-2.5 rounded-lg text-sm outline-none transition-colors"
            style={{
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.08)',
              color: 'rgba(255,255,255,0.92)',
            }}
          />
        </div>

        {error && (
          <div
            className="px-3 py-2 rounded-lg text-xs"
            style={{ background: 'rgba(251,113,133,0.1)', border: '1px solid rgba(251,113,133,0.25)', color: '#fb7185' }}
          >
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={!isValid || submitting}
          className="btn-amber-shimmer w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-lg text-sm font-semibold transition-opacity"
          style={{
            color: '#07071a',
            opacity: !isValid || submitting ? 0.5 : 1,
            cursor: !isValid || submitting ? 'not-allowed' : 'pointer',
          }}
        >
          {submitting ? (
            <>
              <span
                className="inline-block rounded-full"
                style={{
                  width: 14, height: 14,
                  border: '2px solid rgba(7,7,26,0.3)',
                  borderTopColor: '#07071a',
                  animation: 'spin 0.7s linear infinite',
                }}
              />
              Sending notetaker…
            </>
          ) : (
            <>Send notetaker →</>
          )}
        </button>

        <p className="text-xs text-center" style={{ color: 'rgba(255,255,255,0.3)' }}>
          The Basha Notetaker bot will join the meeting and record automatically.
        </p>
      </div>
    </form>
  );
}
