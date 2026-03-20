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
  { value: 'google_meet', label: 'Google Meet', desc: 'meet.google.com' },
  { value: 'zoom', label: 'Zoom', desc: 'zoom.us' },
  { value: 'both', label: 'Both', desc: 'Meet + Zoom' },
];

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

function OptionButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex-1 p-3.5 rounded-lg text-left transition-all duration-150"
      style={{
        background: active ? 'rgba(245,158,11,0.08)' : 'rgba(255,255,255,0.03)',
        border: active ? '1px solid rgba(245,158,11,0.35)' : '1px solid rgba(255,255,255,0.07)',
        borderLeft: active ? '3px solid #f59e0b' : '3px solid transparent',
        paddingLeft: active ? 'calc(0.875rem - 2px)' : '0.875rem',
      }}
    >
      {children}
    </button>
  );
}

export function SettingsForm() {
  const { data: session } = useSession();

  const [languages, setLanguages] = useState<string[]>([]);
  const [savingLangs, setSavingLangs] = useState(false);
  const [savedLangs, setSavedLangs] = useState(false);

  const [platform, setPlatform] = useState('both');
  const [savingPlatform, setSavingPlatform] = useState(false);
  const [savedPlatform, setSavedPlatform] = useState(false);

  const [speakingLanguage, setSpeakingLanguage] = useState('auto');
  const [savingSpeaking, setSavingSpeaking] = useState(false);
  const [savedSpeaking, setSavedSpeaking] = useState(false);

  const [outputLanguage, setOutputLanguage] = useState('en');
  const [savingOutput, setSavingOutput] = useState(false);
  const [savedOutput, setSavedOutput] = useState(false);

  const [outputScript, setOutputScript] = useState<'roman' | 'fully-native' | 'spoken-form-in-native'>('roman');
  const [savingScript, setSavingScript] = useState(false);
  const [savedScript, setSavedScript] = useState(false);

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
        setSpeakingLanguage(data.speaking_language ?? 'auto');
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
    setSavingLangs(true); setSavedLangs(false);
    try {
      await fetch('/api/user/settings', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ preferred_languages: languages }) });
      setSavedLangs(true);
    } finally { setSavingLangs(false); }
  }

  async function savePlatform() {
    setSavingPlatform(true); setSavedPlatform(false);
    try {
      await fetch('/api/user/settings', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ meeting_platform: platform }) });
      setSavedPlatform(true);
    } finally { setSavingPlatform(false); }
  }

  async function saveOutputScript() {
    setSavingScript(true); setSavedScript(false);
    try {
      await fetch('/api/user/settings', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ output_script: outputScript }) });
      setSavedScript(true);
    } finally { setSavingScript(false); }
  }

  async function saveSpeakingLanguage() {
    setSavingSpeaking(true); setSavedSpeaking(false);
    try {
      await fetch('/api/user/settings', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ speaking_language: speakingLanguage }) });
      setSavedSpeaking(true);
    } finally { setSavingSpeaking(false); }
  }

  async function saveOutputLanguage() {
    setSavingOutput(true); setSavedOutput(false);
    try {
      await fetch('/api/user/settings', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ output_language: outputLanguage }) });
      setSavedOutput(true);
    } finally { setSavingOutput(false); }
  }

  async function toggleAutoJoin() {
    const next = !autoJoin;
    setAutoJoin(next);
    setSavingAutoJoin(true);
    try {
      await fetch('/api/user/settings', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ auto_join_all: next }) });
    } finally { setSavingAutoJoin(false); }
  }

  const calendarConnected = session?.user?.googleCalendarConnected;

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
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

      {/* Meeting languages */}
      <SectionCard
        title="Meeting languages"
        description="Languages used in your meetings — Basha captures code-mixed speech natively."
        action={<SaveButton onClick={saveLanguages} saving={savingLangs} saved={savedLangs} />}
      >
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
          {LANGUAGES.map((lang) => {
            const isSelected = languages.includes(lang.code);
            return (
              <button
                key={lang.code}
                type="button"
                onClick={() => toggleLanguage(lang.code)}
                className="relative p-3.5 rounded-lg text-left transition-all duration-150"
                style={{
                  background: isSelected ? 'rgba(245,158,11,0.08)' : 'rgba(255,255,255,0.03)',
                  border: isSelected ? '1px solid rgba(245,158,11,0.35)' : '1px solid rgba(255,255,255,0.07)',
                  borderLeft: isSelected ? '3px solid #f59e0b' : '3px solid transparent',
                  paddingLeft: isSelected ? 'calc(0.875rem - 2px)' : '0.875rem',
                }}
              >
                <div className="font-semibold text-sm" style={{ color: isSelected ? '#f59e0b' : 'rgba(255,255,255,0.75)' }}>{lang.label}</div>
                <div className="text-xs mt-0.5 font-light" style={{ color: 'rgba(255,255,255,0.3)' }}>{lang.native}</div>
                {lang.mixed && (
                  <div className="mt-1.5 text-[10px] font-semibold px-1.5 py-0.5 rounded inline-block tracking-wide" style={{ background: 'rgba(245,158,11,0.1)', color: '#f59e0b' }}>
                    {lang.mixed}
                  </div>
                )}
                {isSelected && (
                  <div className="absolute top-2 right-2 w-4 h-4 rounded-full flex items-center justify-center" style={{ background: '#f59e0b' }}>
                    <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="#07071a" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </SectionCard>

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

      {/* Transcript script */}
      <SectionCard
        title="Transcript script"
        description="How the original language appears in your transcripts."
        action={<SaveButton onClick={saveOutputScript} saving={savingScript} saved={savedScript} />}
      >
        <div className="flex flex-col sm:flex-row gap-2.5">
          {([
            { value: 'roman', label: 'Roman', desc: 'en peru Sai · Mera naam', example: 'Latin script — default' },
            { value: 'fully-native', label: 'Native', desc: 'என் பேரு சாய் · मेरा नाम', example: 'Devanagari / Tamil…' },
            { value: 'spoken-form-in-native', label: 'Spoken', desc: 'spoken form in native', example: 'Spoken form, native script' },
          ] as const).map((opt) => {
            const active = outputScript === opt.value;
            return (
              <OptionButton key={opt.value} active={active} onClick={() => { setOutputScript(opt.value); setSavedScript(false); }}>
                <div className="font-semibold text-sm" style={{ color: active ? '#f59e0b' : 'rgba(255,255,255,0.75)' }}>{opt.label}</div>
                <div className="text-xs mt-1 font-mono font-light" style={{ color: 'rgba(255,255,255,0.35)' }}>{opt.desc}</div>
                <div className="text-[11px] mt-1 font-light" style={{ color: 'rgba(255,255,255,0.22)' }}>{opt.example}</div>
              </OptionButton>
            );
          })}
        </div>
      </SectionCard>

      {/* Meeting platform */}
      <SectionCard
        title="Meeting platform"
        description="Which platforms do you use?"
        action={<SaveButton onClick={savePlatform} saving={savingPlatform} saved={savedPlatform} />}
      >
        <div className="flex flex-col sm:flex-row gap-2.5">
          {PLATFORMS.map((p) => {
            const active = platform === p.value;
            return (
              <OptionButton key={p.value} active={active} onClick={() => { setPlatform(p.value); setSavedPlatform(false); }}>
                <div className="font-semibold text-sm" style={{ color: active ? '#f59e0b' : 'rgba(255,255,255,0.75)' }}>{p.label}</div>
                <div className="text-xs mt-0.5 font-light" style={{ color: 'rgba(255,255,255,0.3)' }}>{p.desc}</div>
              </OptionButton>
            );
          })}
        </div>
      </SectionCard>

      {/* Output language */}
      <SectionCard
        title="Transcript output language"
        description="Basha translates your transcript to this language."
        action={<SaveButton onClick={saveOutputLanguage} saving={savingOutput} saved={savedOutput} />}
      >
        <div className="flex flex-col sm:flex-row gap-2.5">
          {[{ value: 'en', label: 'English', desc: 'Default — works with all AI features' }].map((opt) => {
            const active = outputLanguage === opt.value;
            return (
              <OptionButton key={opt.value} active={active} onClick={() => { setOutputLanguage(opt.value); setSavedOutput(false); }}>
                <div className="font-semibold text-sm" style={{ color: active ? '#f59e0b' : 'rgba(255,255,255,0.75)' }}>{opt.label}</div>
                <div className="text-xs mt-0.5 font-light" style={{ color: 'rgba(255,255,255,0.3)' }}>{opt.desc}</div>
              </OptionButton>
            );
          })}
        </div>
      </SectionCard>

      {/* Auto-join */}
      {calendarConnected && (
        <SectionCard title="Auto-join">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium" style={{ color: 'rgba(255,255,255,0.75)' }}>
                Automatically record all calendar meetings
              </p>
              <p className="text-xs mt-0.5 font-light" style={{ color: 'rgba(255,255,255,0.32)' }}>
                Basha will join every Google Calendar meeting with a link.
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={autoJoin}
              onClick={toggleAutoJoin}
              disabled={savingAutoJoin}
              className="relative flex-shrink-0 w-10 h-5 rounded-full transition-colors duration-200 disabled:opacity-40"
              style={{ background: autoJoin ? '#f59e0b' : 'rgba(255,255,255,0.1)' }}
            >
              <span
                className="absolute top-0.5 left-0.5 w-4 h-4 rounded-full transition-transform duration-200"
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
      <SectionCard
        title="Google Calendar"
        description="Connect to see upcoming meetings and launch bots automatically."
      >
        {calendarConnected ? (
          <div className="flex items-center gap-3 px-4 py-3 rounded-lg" style={{ background: 'rgba(52,211,153,0.06)', border: '1px solid rgba(52,211,153,0.15)' }}>
            <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(52,211,153,0.12)' }}>
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="#34d399" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-semibold" style={{ color: '#34d399' }}>Google Calendar connected</p>
              <p className="text-xs mt-0.5 font-light" style={{ color: 'rgba(255,255,255,0.32)' }}>Upcoming meetings appear on your dashboard</p>
            </div>
          </div>
        ) : (
          <a
            href={`/api/auth/signin/google?callbackUrl=${encodeURIComponent('/settings')}`}
            className="inline-flex items-center gap-2.5 px-4 py-2.5 rounded-lg text-sm font-medium transition-all hover:opacity-80"
            style={{ background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.65)', border: '1px solid rgba(255,255,255,0.1)' }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
