'use client';

import { useState, useEffect } from 'react';

type OutputScript = 'roman' | 'fully-native';

const OPTIONS: { value: OutputScript; label: string; description: string }[] = [
  {
    value: 'roman',
    label: 'Roman / Latin',
    description: 'e.g. "Naan office ku pogiren" — easy to read for anyone',
  },
  {
    value: 'fully-native',
    label: 'Native script',
    description: 'e.g. "நான் ஆஃபிஸ் கு போகிறேன்" — exact original characters',
  },
];

export function TranscriptPreferences() {
  const [outputScript, setOutputScript] = useState<OutputScript>('roman');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch('/api/user/settings')
      .then((r) => r.json())
      .then((data) => {
        const val = data.output_script;
        setOutputScript(val === 'fully-native' ? 'fully-native' : 'roman');
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function handleChange(value: OutputScript) {
    setOutputScript(value);
    setSaving(true);
    setSaved(false);
    try {
      await fetch('/api/user/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ output_script: value }),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      // ignore
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="rounded-2xl p-6 space-y-5"
      style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}
    >
      {/* Header */}
      <div className="flex items-center gap-3">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.2)', color: '#f59e0b' }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
          </svg>
        </div>
        <div>
          <p className="font-semibold text-white text-sm">Transcript Script</p>
          <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.4)' }}>
            How the original language appears in your transcripts
          </p>
        </div>
        {saved && (
          <span
            className="ml-auto text-xs font-semibold"
            style={{ color: '#34d399' }}
          >
            Saved
          </span>
        )}
        {saving && !saved && (
          <span
            className="ml-auto text-xs"
            style={{ color: 'rgba(255,255,255,0.3)' }}
          >
            Saving…
          </span>
        )}
      </div>

      {loading ? (
        <div className="h-10 flex items-center">
          <span className="text-sm" style={{ color: 'rgba(255,255,255,0.3)' }}>Loading…</span>
        </div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {OPTIONS.map((opt) => {
            const selected = outputScript === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => handleChange(opt.value)}
                disabled={saving}
                className="flex items-start gap-3 p-4 rounded-xl text-left transition-all cursor-pointer disabled:opacity-60"
                style={{
                  background: selected ? 'rgba(245,158,11,0.08)' : 'rgba(255,255,255,0.02)',
                  border: selected
                    ? '1px solid rgba(245,158,11,0.3)'
                    : '1px solid rgba(255,255,255,0.06)',
                }}
              >
                {/* Radio dot */}
                <div
                  className="mt-0.5 w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0"
                  style={{
                    border: selected ? '2px solid #f59e0b' : '2px solid rgba(255,255,255,0.2)',
                    background: selected ? 'rgba(245,158,11,0.15)' : 'transparent',
                  }}
                >
                  {selected && (
                    <div className="w-1.5 h-1.5 rounded-full" style={{ background: '#f59e0b' }} />
                  )}
                </div>
                <div>
                  <p className="text-sm font-semibold" style={{ color: selected ? '#f59e0b' : 'rgba(255,255,255,0.75)' }}>
                    {opt.label}
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.35)' }}>
                    {opt.description}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      )}

      <p className="text-xs" style={{ color: 'rgba(255,255,255,0.2)' }}>
        Applies to new recordings. Existing transcripts are not affected.
      </p>
    </div>
  );
}
