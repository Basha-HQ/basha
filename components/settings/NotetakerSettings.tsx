'use client';

import { useEffect, useState } from 'react';
import { signIn } from 'next-auth/react';

interface Settings {
  auto_join_mode: 'off' | 'all' | 'organizer_only';
  bot_display_name: string;
  google_calendar_connected: boolean;
}

const MODE_OPTIONS: Array<{ value: Settings['auto_join_mode']; title: string; subtitle: string }> = [
  {
    value: 'off',
    title: 'Off',
    subtitle: 'Manually launch the bot for each meeting.',
  },
  {
    value: 'all',
    title: 'All my meetings',
    subtitle: 'Automatically join every meeting on my calendar with a video link.',
  },
  {
    value: 'organizer_only',
    title: 'Only meetings I organize',
    subtitle: 'Auto-join only when I am the event organizer.',
  },
];

export function NotetakerSettings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  useEffect(() => {
    fetch('/api/user/settings')
      .then((r) => r.json())
      .then((s) => {
        setSettings({
          auto_join_mode: s.auto_join_mode ?? 'off',
          bot_display_name: s.bot_display_name ?? 'Basha Notetaker',
          google_calendar_connected: !!s.google_calendar_connected,
        });
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  async function patch(updates: Partial<Settings>) {
    if (!settings) return;
    const next = { ...settings, ...updates };
    setSettings(next);
    setSaving(true);
    try {
      await fetch('/api/user/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      setSavedAt(Date.now());
    } finally {
      setSaving(false);
    }
  }

  if (loading || !settings) {
    return (
      <div
        className="rounded-2xl p-6"
        style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}
      >
        <div className="text-sm" style={{ color: 'rgba(255,255,255,0.35)' }}>Loading…</div>
      </div>
    );
  }

  const justSaved = savedAt && Date.now() - savedAt < 2000;

  return (
    <div
      className="rounded-2xl p-6 sm:p-7"
      style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}
    >
      {/* Section header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-lg font-semibold" style={{ color: 'rgba(255,255,255,0.95)' }}>
            Notetaker
          </h2>
          <p className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.4)' }}>
            Decide when Basha should join your meetings to record and transcribe.
          </p>
        </div>
        {saving ? (
          <span className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>Saving…</span>
        ) : justSaved ? (
          <span className="text-xs" style={{ color: '#34d399' }}>Saved</span>
        ) : null}
      </div>

      {/* Calendar connection prompt */}
      {!settings.google_calendar_connected && (
        <div
          className="rounded-xl p-4 mb-5 flex items-start gap-3"
          style={{
            background: 'rgba(245,158,11,0.06)',
            border: '1px solid rgba(245,158,11,0.18)',
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: '#f59e0b', marginTop: 2 }}>
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
            <line x1="16" y1="2" x2="16" y2="6"/>
            <line x1="8" y1="2" x2="8" y2="6"/>
            <line x1="3" y1="10" x2="21" y2="10"/>
          </svg>
          <div className="flex-1">
            <p className="text-sm font-semibold" style={{ color: 'rgba(255,255,255,0.9)' }}>
              Connect Google Calendar
            </p>
            <p className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.55)' }}>
              Auto-join only works for meetings on your calendar. You can still launch the bot manually for ad-hoc meetings.
            </p>
            <button
              onClick={() => signIn('google', { callbackUrl: '/settings' })}
              className="inline-block mt-3 text-xs font-semibold px-3 py-1.5 rounded-lg"
              style={{ background: '#f59e0b', color: '#07071a', border: 'none', cursor: 'pointer' }}
            >
              Connect Calendar →
            </button>
          </div>
        </div>
      )}

      {/* Auto-join mode (radio list) */}
      <div className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: 'rgba(255,255,255,0.45)' }}>
          Auto-join behaviour
        </p>
        <div className="flex flex-col gap-2">
          {MODE_OPTIONS.map((opt) => {
            const active = settings.auto_join_mode === opt.value;
            return (
              <button
                key={opt.value}
                onClick={() => patch({ auto_join_mode: opt.value })}
                className="text-left rounded-xl p-3 transition-all"
                style={{
                  background: active ? 'rgba(245,158,11,0.08)' : 'rgba(255,255,255,0.02)',
                  border: active ? '1px solid rgba(245,158,11,0.4)' : '1px solid rgba(255,255,255,0.06)',
                  cursor: 'pointer',
                }}
              >
                <div className="flex items-start gap-3">
                  <span
                    className="mt-1 rounded-full flex-shrink-0"
                    style={{
                      width: 14, height: 14,
                      border: `1.5px solid ${active ? '#f59e0b' : 'rgba(255,255,255,0.25)'}`,
                      background: active ? '#f59e0b' : 'transparent',
                    }}
                  />
                  <div>
                    <p className="text-sm font-semibold" style={{ color: active ? '#f59e0b' : 'rgba(255,255,255,0.85)' }}>
                      {opt.title}
                    </p>
                    <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.45)' }}>
                      {opt.subtitle}
                    </p>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Bot display name */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: 'rgba(255,255,255,0.45)' }}>
          Notetaker name
        </p>
        <p className="text-xs mb-2" style={{ color: 'rgba(255,255,255,0.4)' }}>
          Shown to other participants when the bot joins.
        </p>
        <input
          type="text"
          maxLength={80}
          value={settings.bot_display_name}
          onChange={(e) => setSettings({ ...settings, bot_display_name: e.target.value })}
          onBlur={(e) => patch({ bot_display_name: e.target.value.trim() || 'Basha Notetaker' })}
          className="w-full px-3 py-2 rounded-lg text-sm outline-none transition-colors"
          style={{
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.08)',
            color: 'rgba(255,255,255,0.9)',
          }}
        />
      </div>
    </div>
  );
}
