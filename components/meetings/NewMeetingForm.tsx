'use client';

import { useState, useEffect } from 'react';
import { BotStatusCard } from './BotStatusCard';
import ExtensionInstallBanner from './ExtensionInstallBanner';
import ExtensionStatusCard from './ExtensionStatusCard';

const LANGUAGE_OPTIONS = [
  { value: 'auto', label: 'Auto' },
  { value: 'hi-IN', label: 'Hindi' },
  { value: 'ta-IN', label: 'Tamil' },
  { value: 'te-IN', label: 'Telugu' },
  { value: 'kn-IN', label: 'Kannada' },
  { value: 'en-IN', label: 'English' },
];

type Tab = 'extension' | 'bot';
type Mode = 'form' | 'bot-status' | 'extension-status';

function RocketIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z" />
      <path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z" />
      <path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0" />
      <path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5" />
    </svg>
  );
}

interface DarkInputProps {
  label: string;
  id: string;
  type?: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
}

function DarkInput({ label, id, type = 'text', value, onChange, placeholder }: DarkInputProps) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-medium" style={{ color: 'rgba(255,255,255,0.6)' }}>
        {label}
      </label>
      <input
        id={id}
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className="w-full px-4 py-3 rounded-xl text-sm outline-none transition-all"
        style={{
          background: 'rgba(255,255,255,0.05)',
          border: '1px solid rgba(255,255,255,0.1)',
          color: 'rgba(255,255,255,0.85)',
        }}
        onFocus={(e) => {
          (e.target as HTMLInputElement).style.borderColor = 'rgba(245,158,11,0.5)';
          (e.target as HTMLInputElement).style.boxShadow = '0 0 0 3px rgba(245,158,11,0.08)';
        }}
        onBlur={(e) => {
          (e.target as HTMLInputElement).style.borderColor = 'rgba(255,255,255,0.1)';
          (e.target as HTMLInputElement).style.boxShadow = 'none';
        }}
      />
    </div>
  );
}

function generateDefaultTitle(meetingUrl: string): string {
  const platform = meetingUrl.includes('meet.google.com')
    ? 'Google Meet'
    : meetingUrl.includes('zoom.us')
    ? 'Zoom Meeting'
    : 'Meeting';
  const now = new Date();
  const dateStr = now.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  const timeStr = now.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true });
  return `${platform} · ${dateStr}, ${timeStr}`;
}

/** True if the Basha extension is installed in this browser */
function useExtensionDetected() {
  const [detected, setDetected] = useState<boolean | null>(null);
  useEffect(() => {
    let resolved = false;
    const handler = (event: MessageEvent) => {
      if (event.data?.type === 'BASHA_PONG' && !resolved) {
        resolved = true;
        setDetected(true);
      }
    };
    window.addEventListener('message', handler);
    window.postMessage({ type: 'BASHA_PING' }, '*');
    const t = setTimeout(() => { if (!resolved) setDetected(false); }, 700);
    return () => { window.removeEventListener('message', handler); clearTimeout(t); };
  }, []);
  return detected;
}

export function NewMeetingForm() {
  const [activeTab, setActiveTab] = useState<Tab>('extension');
  const [mode, setMode] = useState<Mode>('form');

  // Bot tab state
  const [meetingLink, setMeetingLink] = useState('');
  const [sourceLanguage, setSourceLanguage] = useState('auto');
  const [error, setError] = useState('');
  const [botId, setBotId] = useState('');
  const [botMeetingId, setBotMeetingId] = useState('');

  // Extension tab state
  const [extensionMeetingId, setExtensionMeetingId] = useState('');
  const extensionDetected = useExtensionDetected();

  // Listen for the extension creating a session (extension sends meetingId via postMessage)
  useEffect(() => {
    const handler = (event: MessageEvent) => {
      if (event.data?.type === 'BASHA_RECORDING_STARTED' && event.data.meetingId) {
        setExtensionMeetingId(event.data.meetingId);
        setMode('extension-status');
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, []);

  async function safeJson(res: Response): Promise<Record<string, string>> {
    try { return await res.json(); } catch { return {}; }
  }

  async function handleLaunchBot() {
    setError('');
    if (!meetingLink) { setError('Please enter a meeting link'); return; }
    try {
      const res = await fetch('/api/bots', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ meetingUrl: meetingLink, title: generateDefaultTitle(meetingLink), sourceLanguage }),
      });
      if (!res.ok) { const e = await safeJson(res); throw new Error(e.error || `Bot launch failed (${res.status})`); }
      const data = await res.json();
      setBotId(data.botId);
      setBotMeetingId(data.meetingId);
      setMode('bot-status');
    } catch (err) {
      setError(String(err));
    }
  }

  // Render status cards when active
  if (mode === 'bot-status') return <BotStatusCard botId={botId} meetingId={botMeetingId} />;
  if (mode === 'extension-status') {
    return (
      <ExtensionStatusCard
        meetingId={extensionMeetingId}
        onCancel={() => { setMode('form'); setExtensionMeetingId(''); }}
      />
    );
  }

  return (
    <div>
      {/* Tabs */}
      <div className="flex rounded-xl overflow-hidden mb-4" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
        <button
          type="button"
          onClick={() => setActiveTab('extension')}
          className="flex-1 py-2.5 text-sm font-semibold transition-all"
          style={activeTab === 'extension'
            ? { background: 'rgba(99,102,241,0.2)', color: '#a5b4fc', borderBottom: '2px solid #6366f1' }
            : { color: 'rgba(255,255,255,0.35)', borderBottom: '2px solid transparent' }}
        >
          🎙 Record with Extension
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('bot')}
          className="flex-1 py-2.5 text-sm font-semibold transition-all"
          style={activeTab === 'bot'
            ? { background: 'rgba(245,158,11,0.1)', color: '#fbbf24', borderBottom: '2px solid #f59e0b' }
            : { color: 'rgba(255,255,255,0.35)', borderBottom: '2px solid transparent' }}
        >
          🤖 Use Bot <span className="text-xs font-normal opacity-60">(Backup)</span>
        </button>
      </div>

      <div className="rounded-2xl overflow-hidden" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
        <div className="p-5 sm:p-6 space-y-5">

          {/* ──────────────── EXTENSION TAB ──────────────── */}
          {activeTab === 'extension' && (
            <div className="space-y-5">
              {/* Extension not yet detected / not installed */}
              {extensionDetected === false && <ExtensionInstallBanner />}

              {/* Extension detected — show ready state */}
              {extensionDetected === true && (
                <>
                  {/* Language picker */}
                  <div className="space-y-2">
                    <label className="block text-sm font-medium" style={{ color: 'rgba(255,255,255,0.6)' }}>
                      Recording language
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {LANGUAGE_OPTIONS.map((opt) => {
                        const active = sourceLanguage === opt.value;
                        return (
                          <button
                            key={opt.value}
                            type="button"
                            onClick={() => setSourceLanguage(opt.value)}
                            className="px-3.5 py-1.5 rounded-xl text-sm font-medium transition-all"
                            style={{
                              background: active ? 'rgba(99,102,241,0.2)' : 'rgba(255,255,255,0.05)',
                              color: active ? '#a5b4fc' : 'rgba(255,255,255,0.45)',
                              border: active ? '1px solid rgba(99,102,241,0.4)' : '1px solid rgba(255,255,255,0.08)',
                            }}
                          >
                            {opt.label}
                          </button>
                        );
                      })}
                    </div>
                    <p className="text-xs" style={{ color: 'rgba(255,255,255,0.25)' }}>
                      Helps transcribe code-mixed speech (Hinglish, Tanglish, etc.) accurately
                    </p>
                  </div>

                  {/* Instruction card */}
                  <div className="px-4 py-3.5 rounded-xl text-sm leading-relaxed space-y-1" style={{ background: 'rgba(99,102,241,0.07)', border: '1px solid rgba(99,102,241,0.15)', color: 'rgba(255,255,255,0.55)' }}>
                    <p className="font-medium" style={{ color: 'rgba(255,255,255,0.75)' }}>
                      How to record with the extension
                    </p>
                    <ol className="text-xs space-y-1 list-decimal list-inside" style={{ color: 'rgba(255,255,255,0.4)' }}>
                      <li>Open your Google Meet, Zoom, or Teams tab</li>
                      <li>Click the <strong style={{ color: 'rgba(255,255,255,0.65)' }}>Basha icon</strong> in your Chrome toolbar</li>
                      <li>Select language and click <strong style={{ color: 'rgba(255,255,255,0.65)' }}>Start Recording</strong></li>
                      <li>Click Stop when your meeting ends — transcript will appear here</li>
                    </ol>
                  </div>

                  <div className="px-4 py-3 rounded-xl text-xs" style={{ background: 'rgba(16,185,129,0.07)', border: '1px solid rgba(16,185,129,0.15)', color: 'rgba(52,211,153,0.8)' }}>
                    ✓ Extension connected · No bot will join your call
                  </div>
                </>
              )}

              {/* Still checking */}
              {extensionDetected === null && (
                <div className="flex items-center justify-center h-20 text-slate-500 text-sm">
                  Checking for Basha extension…
                </div>
              )}
            </div>
          )}

          {/* ──────────────── BOT TAB ──────────────── */}
          {activeTab === 'bot' && (
            <div className="space-y-4">
              {/* Language pills */}
              <div className="space-y-2">
                <label className="block text-sm font-medium" style={{ color: 'rgba(255,255,255,0.6)' }}>
                  Meeting language
                </label>
                <div className="flex flex-wrap gap-2">
                  {LANGUAGE_OPTIONS.map((opt) => {
                    const active = sourceLanguage === opt.value;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setSourceLanguage(opt.value)}
                        className="px-3.5 py-1.5 rounded-xl text-sm font-medium transition-all"
                        style={{
                          background: active ? 'rgba(245,158,11,0.15)' : 'rgba(255,255,255,0.05)',
                          color: active ? '#f59e0b' : 'rgba(255,255,255,0.45)',
                          border: active ? '1px solid rgba(245,158,11,0.35)' : '1px solid rgba(255,255,255,0.08)',
                        }}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <DarkInput
                label="Meeting link"
                id="meetingLink"
                type="url"
                value={meetingLink}
                onChange={(e) => setMeetingLink(e.target.value)}
                placeholder="https://meet.google.com/abc-defg-hij"
              />

              {error && (
                <div className="px-4 py-3 rounded-xl text-sm" style={{ background: 'rgba(251,113,133,0.1)', border: '1px solid rgba(251,113,133,0.2)', color: '#fb7185' }}>
                  {error}
                </div>
              )}

              <button
                type="button"
                onClick={handleLaunchBot}
                disabled={!meetingLink}
                className="w-full flex items-center justify-center gap-2.5 py-3.5 rounded-xl text-sm font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed hover:scale-[1.01] active:scale-[0.99]"
                style={meetingLink ? { background: 'linear-gradient(90deg, #f59e0b 0%, #fbbf24 25%, #f59e0b 50%, #fbbf24 75%, #f59e0b 100%)', backgroundSize: '400% auto', color: '#07071a' } : { background: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.3)' }}
              >
                <RocketIcon />
                Launch bot into meeting
              </button>

              <div className="px-4 py-3 rounded-xl text-xs leading-relaxed" style={{ background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.12)', color: 'rgba(255,255,255,0.35)' }}>
                ⚠ A visible bot joins your call. Other participants will see it in the attendee list. Use for Zoom desktop, Teams desktop, or non-Chrome browsers.
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
