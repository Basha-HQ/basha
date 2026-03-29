'use client';

import { useState, useEffect } from 'react';

function SectionCard({ title, description, children, action }: {
  title: string;
  description?: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{ border: '1px solid rgba(255,255,255,0.07)', background: 'rgba(255,255,255,0.02)' }}
    >
      <div
        className="px-5 py-4 flex items-center justify-between gap-4"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}
      >
        <div>
          <h2 className="text-sm font-semibold" style={{ color: 'rgba(255,255,255,0.82)' }}>{title}</h2>
          {description && (
            <p className="text-xs mt-0.5 font-light" style={{ color: 'rgba(255,255,255,0.38)' }}>{description}</p>
          )}
        </div>
        {action}
      </div>
      <div className="px-5 py-5">
        {children}
      </div>
    </div>
  );
}

function SaveButton({ onClick, saving, saved }: { onClick: () => void; saving: boolean; saved: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={saving}
      className="text-xs font-semibold transition-all disabled:opacity-40 px-3 py-1.5 rounded-lg"
      style={{
        background: saved ? 'rgba(52,211,153,0.1)' : 'rgba(245,158,11,0.1)',
        color: saved ? '#34d399' : '#f59e0b',
        border: `1px solid ${saved ? 'rgba(52,211,153,0.2)' : 'rgba(245,158,11,0.2)'}`,
      }}
    >
      {saving ? 'Saving…' : saved ? '✓ Saved' : 'Save'}
    </button>
  );
}

export function SettingsForm() {
  const [speakingLanguage, setSpeakingLanguage] = useState('auto');
  const [savingSpeaking, setSavingSpeaking] = useState(false);
  const [savedSpeaking, setSavedSpeaking] = useState(false);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/user/settings')
      .then((r) => r.json())
      .then((data) => {
        setSpeakingLanguage(data.speaking_language ?? 'auto');
      })
      .catch(() => setError('Failed to load settings'))
      .finally(() => setLoading(false));
  }, []);

  async function saveSpeakingLanguage() {
    setSavingSpeaking(true); setSavedSpeaking(false);
    try {
      await fetch('/api/user/settings', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ speaking_language: speakingLanguage }) });
      setSavedSpeaking(true);
    } finally { setSavingSpeaking(false); }
  }

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2].map((i) => (
          <div key={i} className="h-36 rounded-xl animate-pulse" style={{ background: 'rgba(255,255,255,0.03)' }} />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="px-4 py-3 rounded-xl text-sm font-light" style={{ background: 'rgba(251,113,133,0.08)', border: '1px solid rgba(251,113,133,0.18)', color: '#fb7185' }}>
          {error}
        </div>
      )}

      {/* Primary speaking language */}
      <SectionCard
        title="Primary speaking language"
        description="Your main language — helps Basha transcribe code-mixed speech accurately."
        action={<SaveButton onClick={saveSpeakingLanguage} saving={savingSpeaking} saved={savedSpeaking} />}
      >
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
          {([
            { code: 'auto', label: 'Auto-detect', native: 'Basha detects' },
            { code: 'ta-IN', label: 'Tamil', native: 'தமிழ்' },
            { code: 'hi-IN', label: 'Hindi', native: 'हिन्दी' },
            { code: 'te-IN', label: 'Telugu', native: 'తెలుగు' },
            { code: 'kn-IN', label: 'Kannada', native: 'ಕನ್ನಡ' },
            { code: 'ml-IN', label: 'Malayalam', native: 'മലയാളം' },
            { code: 'mr-IN', label: 'Marathi', native: 'मराठी' },
            { code: 'bn-IN', label: 'Bengali', native: 'বাংলা' },
            { code: 'en-IN', label: 'English', native: 'English only' },
          ] as const).map((lang) => {
            const active = speakingLanguage === lang.code;
            return (
              <button
                key={lang.code}
                type="button"
                onClick={() => { setSpeakingLanguage(lang.code); setSavedSpeaking(false); }}
                className="p-3.5 rounded-lg text-left transition-all duration-150"
                style={{
                  background: active ? 'rgba(245,158,11,0.08)' : 'rgba(255,255,255,0.03)',
                  border: active ? '1px solid rgba(245,158,11,0.35)' : '1px solid rgba(255,255,255,0.07)',
                  borderLeft: active ? '3px solid #f59e0b' : '3px solid transparent',
                  paddingLeft: active ? 'calc(0.875rem - 2px)' : '0.875rem',
                }}
              >
                <div className="font-semibold text-sm" style={{ color: active ? '#f59e0b' : 'rgba(255,255,255,0.75)' }}>{lang.label}</div>
                <div className="text-xs mt-0.5 font-light" style={{ color: 'rgba(255,255,255,0.3)' }}>{lang.native}</div>
              </button>
            );
          })}
        </div>
      </SectionCard>
    </div>
  );
}
