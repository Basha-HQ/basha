'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';

const LANGUAGES = [
  { code: 'en', label: 'English', native: 'English', mixed: null },
  { code: 'hi', label: 'Hindi', native: 'हिन्दी', mixed: 'Hinglish' },
  { code: 'ta', label: 'Tamil', native: 'தமிழ்', mixed: 'Tanglish' },
  { code: 'te', label: 'Telugu', native: 'తెలుగు', mixed: 'Teluglish' },
  { code: 'kn', label: 'Kannada', native: 'ಕನ್ನಡ', mixed: 'Kanglish' },
];

const PLATFORMS = [
  { value: 'google_meet', label: 'Google Meet', desc: 'meet.google.com links' },
  { value: 'zoom', label: 'Zoom', desc: 'zoom.us links' },
  { value: 'both', label: 'Both', desc: 'Google Meet + Zoom' },
];

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl p-6" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
      <h2 className="text-sm font-bold uppercase tracking-widest mb-5" style={{ color: 'rgba(255,255,255,0.35)' }}>
        {title}
      </h2>
      {children}
    </div>
  );
}

function SaveButton({ onClick, saving, saved }: { onClick: () => void; saving: boolean; saved: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={saving}
      className="mt-5 px-5 py-2.5 rounded-xl text-sm font-bold transition-all disabled:opacity-50"
      style={{ background: saved ? 'rgba(52,211,153,0.15)' : 'rgba(245,158,11,0.15)', color: saved ? '#34d399' : '#f59e0b', border: `1px solid ${saved ? 'rgba(52,211,153,0.3)' : 'rgba(245,158,11,0.3)'}` }}
    >
      {saving ? 'Saving…' : saved ? 'Saved ✓' : 'Save changes'}
    </button>
  );
}

export function SettingsForm() {
  const { data: session } = useSession();

  // Language preferences
  const [languages, setLanguages] = useState<string[]>([]);
  const [savingLangs, setSavingLangs] = useState(false);
  const [savedLangs, setSavedLangs] = useState(false);

  // Meeting platform
  const [platform, setPlatform] = useState('both');
  const [savingPlatform, setSavingPlatform] = useState(false);
  const [savedPlatform, setSavedPlatform] = useState(false);

  // Output language (transcript translation target)
  const [outputLanguage, setOutputLanguage] = useState('en');
  const [savingOutput, setSavingOutput] = useState(false);
  const [savedOutput, setSavedOutput] = useState(false);

  // Output script (how original language is rendered)
  const [outputScript, setOutputScript] = useState<'roman' | 'fully-native' | 'spoken-form-in-native'>('roman');
  const [savingScript, setSavingScript] = useState(false);
  const [savedScript, setSavedScript] = useState(false);

  // Auto-join calendar meetings
  const [autoJoin, setAutoJoin] = useState(false);
  const [savingAutoJoin, setSavingAutoJoin] = useState(false);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/user/settings')
      .then((r) => r.json())
      .then((data) => {
        setLanguages(data.preferred_languages ?? []);
        setPlatform(data.meeting_platform ?? 'both');
        setOutputLanguage(data.output_language ?? 'en');
        setOutputScript(data.output_script ?? 'roman');
        setAutoJoin(data.auto_join_all ?? false);
      })
      .catch(() => setError('Failed to load settings'))
      .finally(() => setLoading(false));
  }, []);

  function toggleLanguage(code: string) {
    setSavedLangs(false);
    setLanguages((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]
    );
  }

  async function saveLanguages() {
    setSavingLangs(true);
    setSavedLangs(false);
    try {
      await fetch('/api/user/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ preferred_languages: languages }),
      });
      setSavedLangs(true);
    } finally {
      setSavingLangs(false);
    }
  }

  async function savePlatform() {
    setSavingPlatform(true);
    setSavedPlatform(false);
    try {
      await fetch('/api/user/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ meeting_platform: platform }),
      });
      setSavedPlatform(true);
    } finally {
      setSavingPlatform(false);
    }
  }

  async function saveOutputScript() {
    setSavingScript(true);
    setSavedScript(false);
    try {
      await fetch('/api/user/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ output_script: outputScript }),
      });
      setSavedScript(true);
    } finally {
      setSavingScript(false);
    }
  }

  async function saveOutputLanguage() {
    setSavingOutput(true);
    setSavedOutput(false);
    try {
      await fetch('/api/user/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ output_language: outputLanguage }),
      });
      setSavedOutput(true);
    } finally {
      setSavingOutput(false);
    }
  }

  async function toggleAutoJoin() {
    const next = !autoJoin;
    setAutoJoin(next);
    setSavingAutoJoin(true);
    try {
      await fetch('/api/user/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ auto_join_all: next }),
      });
    } finally {
      setSavingAutoJoin(false);
    }
  }

  const calendarConnected = session?.user?.googleCalendarConnected;

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-40 rounded-2xl animate-pulse" style={{ background: 'rgba(255,255,255,0.04)' }} />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="px-4 py-3 rounded-xl text-sm" style={{ background: 'rgba(251,113,133,0.1)', border: '1px solid rgba(251,113,133,0.2)', color: '#fb7185' }}>
          {error}
        </div>
      )}

      {/* Language preferences */}
      <SectionCard title="Meeting languages">
        <p className="text-sm mb-4" style={{ color: 'rgba(255,255,255,0.45)' }}>
          Select all languages used in your meetings. Basha captures code-mixed speech natively.
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {LANGUAGES.map((lang) => {
            const isSelected = languages.includes(lang.code);
            return (
              <button
                key={lang.code}
                type="button"
                onClick={() => toggleLanguage(lang.code)}
                className="relative p-4 rounded-2xl text-left transition-all duration-150"
                style={{
                  background: isSelected ? 'rgba(245,158,11,0.15)' : 'rgba(255,255,255,0.04)',
                  border: isSelected ? '1.5px solid rgba(245,158,11,0.6)' : '1.5px solid rgba(255,255,255,0.08)',
                }}
              >
                <div className="font-bold text-white text-sm">{lang.label}</div>
                <div className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.35)' }}>{lang.native}</div>
                {lang.mixed && (
                  <div className="mt-2 text-xs font-semibold px-2 py-0.5 rounded-full inline-block" style={{ background: 'rgba(245,158,11,0.15)', color: '#f59e0b' }}>
                    {lang.mixed}
                  </div>
                )}
                {isSelected && (
                  <div className="absolute top-2 right-2 w-5 h-5 rounded-full flex items-center justify-center" style={{ background: '#f59e0b' }}>
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="#07071a" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                )}
              </button>
            );
          })}
        </div>
        <SaveButton onClick={saveLanguages} saving={savingLangs} saved={savedLangs} />
      </SectionCard>

      {/* Transcript script */}
      <SectionCard title="Transcript Script">
        <p className="text-sm mb-4" style={{ color: 'rgba(255,255,255,0.45)' }}>
          Choose how the original language appears in your transcripts. Affects new recordings only.
        </p>
        <div className="flex flex-col sm:flex-row gap-3">
          {([
            { value: 'roman', label: 'Roman', desc: 'en peru Sai · Mera naam kya hai', example: 'Default — Latin script' },
            { value: 'fully-native', label: 'Native Script', desc: 'என் பேரு சாய் · मेरा नाम क्या है', example: 'Devanagari / Tamil / Telugu…' },
            { value: 'spoken-form-in-native', label: 'Spoken (Native)', desc: 'என் பேரு சாய் · मेरा नाम क्या है', example: 'Spoken form in native script' },
          ] as const).map((opt) => {
            const active = outputScript === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => { setOutputScript(opt.value); setSavedScript(false); }}
                className="flex-1 p-4 rounded-xl text-left transition-all"
                style={{
                  background: active ? 'rgba(245,158,11,0.12)' : 'rgba(255,255,255,0.04)',
                  border: active ? '1.5px solid rgba(245,158,11,0.5)' : '1.5px solid rgba(255,255,255,0.08)',
                }}
              >
                <div className="font-semibold text-sm" style={{ color: active ? '#f59e0b' : 'rgba(255,255,255,0.75)' }}>{opt.label}</div>
                <div className="text-xs mt-1 font-mono" style={{ color: 'rgba(255,255,255,0.4)' }}>{opt.desc}</div>
                <div className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.25)' }}>{opt.example}</div>
              </button>
            );
          })}
        </div>
        <SaveButton onClick={saveOutputScript} saving={savingScript} saved={savedScript} />
      </SectionCard>

      {/* Meeting platform */}
      <SectionCard title="Meeting platform">
        <p className="text-sm mb-4" style={{ color: 'rgba(255,255,255,0.45)' }}>
          Which platforms do you use for meetings?
        </p>
        <div className="flex flex-col sm:flex-row gap-3">
          {PLATFORMS.map((p) => {
            const active = platform === p.value;
            return (
              <button
                key={p.value}
                type="button"
                onClick={() => { setPlatform(p.value); setSavedPlatform(false); }}
                className="flex-1 p-4 rounded-xl text-left transition-all"
                style={{
                  background: active ? 'rgba(245,158,11,0.12)' : 'rgba(255,255,255,0.04)',
                  border: active ? '1.5px solid rgba(245,158,11,0.5)' : '1.5px solid rgba(255,255,255,0.08)',
                }}
              >
                <div className="font-semibold text-sm" style={{ color: active ? '#f59e0b' : 'rgba(255,255,255,0.75)' }}>{p.label}</div>
                <div className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.3)' }}>{p.desc}</div>
              </button>
            );
          })}
        </div>
        <SaveButton onClick={savePlatform} saving={savingPlatform} saved={savedPlatform} />
      </SectionCard>

      {/* Output language */}
      <SectionCard title="Transcript output language">
        <p className="text-sm mb-4" style={{ color: 'rgba(255,255,255,0.45)' }}>
          Basha translates your meeting transcript to this language.
        </p>
        <div className="flex flex-col sm:flex-row gap-3">
          {[
            { value: 'en', label: 'English', desc: 'Default — works with all AI features' },
          ].map((opt) => {
            const active = outputLanguage === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => { setOutputLanguage(opt.value); setSavedOutput(false); }}
                className="flex-1 p-4 rounded-xl text-left transition-all"
                style={{
                  background: active ? 'rgba(245,158,11,0.12)' : 'rgba(255,255,255,0.04)',
                  border: active ? '1.5px solid rgba(245,158,11,0.5)' : '1.5px solid rgba(255,255,255,0.08)',
                }}
              >
                <div className="font-semibold text-sm" style={{ color: active ? '#f59e0b' : 'rgba(255,255,255,0.75)' }}>{opt.label}</div>
                <div className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.3)' }}>{opt.desc}</div>
              </button>
            );
          })}
        </div>
        <SaveButton onClick={saveOutputLanguage} saving={savingOutput} saved={savedOutput} />
      </SectionCard>

      {/* Auto-join calendar meetings */}
      {calendarConnected && (
        <SectionCard title="Auto-join">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium" style={{ color: 'rgba(255,255,255,0.75)' }}>
                Automatically record all calendar meetings
              </p>
              <p className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.35)' }}>
                Basha will join every upcoming Google Calendar meeting that has a link.
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={autoJoin}
              onClick={toggleAutoJoin}
              disabled={savingAutoJoin}
              className="relative flex-shrink-0 w-11 h-6 rounded-full transition-colors duration-200 disabled:opacity-50"
              style={{ background: autoJoin ? '#f59e0b' : 'rgba(255,255,255,0.12)' }}
            >
              <span
                className="absolute top-0.5 left-0.5 w-5 h-5 rounded-full transition-transform duration-200"
                style={{
                  background: 'white',
                  transform: autoJoin ? 'translateX(20px)' : 'translateX(0)',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.4)',
                }}
              />
            </button>
          </div>
        </SectionCard>
      )}

      {/* Google Calendar */}
      <SectionCard title="Google Calendar">
        <p className="text-sm mb-5" style={{ color: 'rgba(255,255,255,0.45)' }}>
          Connect your Google Calendar to see upcoming meetings and launch bots automatically.
        </p>
        {calendarConnected ? (
          <div className="flex items-center gap-3 px-4 py-3 rounded-xl" style={{ background: 'rgba(52,211,153,0.08)', border: '1px solid rgba(52,211,153,0.2)' }}>
            <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(52,211,153,0.15)' }}>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="#34d399" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-semibold" style={{ color: '#34d399' }}>Google Calendar connected</p>
              <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.35)' }}>Upcoming meetings will appear on your dashboard</p>
            </div>
          </div>
        ) : (
          <a
            href={`/api/auth/signin/google?callbackUrl=${encodeURIComponent('/settings')}`}
            className="inline-flex items-center gap-2.5 px-5 py-3 rounded-xl text-sm font-semibold transition-all hover:scale-[1.02] active:scale-[0.98]"
            style={{ background: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.75)', border: '1px solid rgba(255,255,255,0.12)' }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
              <line x1="16" y1="2" x2="16" y2="6" />
              <line x1="8" y1="2" x2="8" y2="6" />
              <line x1="3" y1="10" x2="21" y2="10" />
            </svg>
            Connect Google Calendar
          </a>
        )}
      </SectionCard>
    </div>
  );
}
