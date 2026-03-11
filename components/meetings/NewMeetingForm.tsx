'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { BotStatusCard } from './BotStatusCard';

const LANGUAGE_OPTIONS = [
  { value: 'auto', label: 'Auto' },
  { value: 'hi-IN', label: 'Hindi' },
  { value: 'ta-IN', label: 'Tamil' },
  { value: 'te-IN', label: 'Telugu' },
  { value: 'kn-IN', label: 'Kannada' },
  { value: 'en-IN', label: 'English' },
];

type Mode = 'form' | 'uploading' | 'processing' | 'bot';
type Tab = 'bot' | 'upload';

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

function UploadIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="17 8 12 3 7 8" />
      <line x1="12" y1="3" x2="12" y2="15" />
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

export function NewMeetingForm() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>('form');
  const [activeTab, setActiveTab] = useState<Tab>('bot');
  const [meetingLink, setMeetingLink] = useState('');
  const [title, setTitle] = useState('');
  const [sourceLanguage, setSourceLanguage] = useState('auto');
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState('');
  const [progress, setProgress] = useState('');
  const [botId, setBotId] = useState('');
  const [botMeetingId, setBotMeetingId] = useState('');

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
        body: JSON.stringify({ meetingUrl: meetingLink, title: title || 'Bot Meeting', sourceLanguage }),
      });
      if (!res.ok) { const e = await safeJson(res); throw new Error(e.error || `Bot launch failed (${res.status})`); }
      const data = await res.json();
      setBotId(data.botId);
      setBotMeetingId(data.meetingId);
      setMode('bot');
    } catch (err) {
      setError(String(err));
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!audioFile) { setError('Please upload an audio file'); return; }
    setMode('uploading');
    try {
      setProgress('Creating meeting...');
      const createRes = await fetch('/api/meetings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ meetingLink: meetingLink || 'manual-upload', title: title || 'Untitled Meeting', sourceLanguage }),
      });
      if (!createRes.ok) { const e = await safeJson(createRes); throw new Error(e.error ?? 'Failed to create meeting'); }
      const { meeting } = await createRes.json();

      setProgress('Uploading audio...');
      const formData = new FormData();
      formData.append('audio', audioFile);
      const uploadRes = await fetch(`/api/meetings/${meeting.id}/audio`, { method: 'POST', body: formData });
      if (!uploadRes.ok) { const e = await safeJson(uploadRes); throw new Error(e.error ?? 'Upload failed'); }

      setMode('processing');
      setProgress('Transcribing and translating… This may take a few minutes.');
      const processRes = await fetch(`/api/meetings/${meeting.id}/process`, { method: 'POST' });
      if (!processRes.ok) { const e = await safeJson(processRes); throw new Error(e.error ?? 'Processing failed'); }
      router.push(`/meetings/${meeting.id}`);
    } catch (err) {
      setError(String(err));
      setMode('form');
    }
  }

  // Bot status view
  if (mode === 'bot') return <BotStatusCard botId={botId} meetingId={botMeetingId} />;

  // Processing state
  if (mode === 'processing') {
    return (
      <div className="rounded-2xl p-14 text-center" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
        <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl mx-auto mb-4 animate-pulse" style={{ background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.2)' }}>
          🧠
        </div>
        <h2 className="text-lg font-bold mb-2" style={{ color: 'rgba(255,255,255,0.85)' }}>Processing your meeting</h2>
        <p className="text-sm mb-6" style={{ color: 'rgba(255,255,255,0.4)' }}>{progress}</p>
        <div className="flex justify-center">
          <div className="w-56 h-1 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.08)' }}>
            <div className="h-full rounded-full animate-pulse w-3/4" style={{ background: 'linear-gradient(90deg, #6366f1, #f59e0b)' }} />
          </div>
        </div>
      </div>
    );
  }

  // Uploading state
  if (mode === 'uploading') {
    return (
      <div className="rounded-2xl p-14 text-center" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
        <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl mx-auto mb-4 animate-bounce" style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.2)' }}>
          ⬆️
        </div>
        <h2 className="text-lg font-bold mb-2" style={{ color: 'rgba(255,255,255,0.85)' }}>Uploading audio</h2>
        <p className="text-sm" style={{ color: 'rgba(255,255,255,0.4)' }}>{progress}</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="rounded-2xl overflow-hidden" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
        {/* Tabs */}
        <div className="flex" style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
          {([
            { key: 'bot' as Tab, label: 'Live Meeting Bot', icon: <RocketIcon /> },
            { key: 'upload' as Tab, label: 'Upload Audio', icon: <UploadIcon /> },
          ]).map((tab) => {
            const active = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                className="flex-1 flex items-center justify-center gap-2 py-4 text-sm font-semibold transition-all"
                style={{
                  color: active ? '#f59e0b' : 'rgba(255,255,255,0.4)',
                  background: active ? 'rgba(245,158,11,0.06)' : 'transparent',
                  borderBottom: active ? '2px solid #f59e0b' : '2px solid transparent',
                }}
              >
                <span>{tab.icon}</span>
                {tab.label}
              </button>
            );
          })}
        </div>

        <div className="p-5 sm:p-6 space-y-5">
          {/* Common: title */}
          <DarkInput
            label="Meeting title"
            id="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Q2 Planning · Marketing Team"
          />

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
            <p className="text-xs" style={{ color: 'rgba(255,255,255,0.25)' }}>
              Helps transcribe code-mixed speech (Hinglish, Tanglish, etc.) accurately
            </p>
          </div>

          {/* Bot tab */}
          {activeTab === 'bot' && (
            <div className="space-y-4">
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

              <div className="px-4 py-3 rounded-xl text-xs leading-relaxed" style={{ background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.15)', color: 'rgba(255,255,255,0.45)' }}>
                A silent bot joins your call, records audio, and auto-generates a multilingual transcript when the meeting ends.
              </div>
            </div>
          )}

          {/* Upload tab */}
          {activeTab === 'upload' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: 'rgba(255,255,255,0.6)' }}>
                  Audio file
                </label>
                <div
                  className="rounded-2xl p-10 text-center transition-all cursor-pointer"
                  style={{
                    background: dragOver
                      ? 'rgba(245,158,11,0.08)'
                      : audioFile
                      ? 'rgba(245,158,11,0.05)'
                      : 'rgba(255,255,255,0.02)',
                    border: dragOver
                      ? '2px dashed rgba(245,158,11,0.5)'
                      : audioFile
                      ? '2px dashed rgba(245,158,11,0.3)'
                      : '2px dashed rgba(255,255,255,0.1)',
                  }}
                  onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={(e) => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) setAudioFile(f); }}
                >
                  {audioFile ? (
                    <div>
                      <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl mx-auto mb-3" style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.2)' }}>🎵</div>
                      <p className="font-semibold text-sm" style={{ color: 'rgba(255,255,255,0.85)' }}>{audioFile.name}</p>
                      <p className="text-xs mt-1 mb-3" style={{ color: 'rgba(255,255,255,0.35)' }}>{(audioFile.size / 1024 / 1024).toFixed(1)} MB</p>
                      <button type="button" onClick={() => setAudioFile(null)} className="text-xs transition-colors" style={{ color: '#fb7185' }}>
                        Remove file
                      </button>
                    </div>
                  ) : (
                    <div>
                      <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl mx-auto mb-3" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}>🎙️</div>
                      <p className="font-medium text-sm mb-1" style={{ color: 'rgba(255,255,255,0.6)' }}>Drag &amp; drop audio here</p>
                      <p className="text-xs mb-4" style={{ color: 'rgba(255,255,255,0.25)' }}>WAV, MP3, OGG, WebM · Max 200 MB</p>
                      <label
                        className="cursor-pointer inline-flex items-center px-4 py-2 rounded-xl text-sm font-medium transition-all"
                        style={{ background: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.6)', border: '1px solid rgba(255,255,255,0.12)' }}
                      >
                        Browse file
                        <input type="file" accept="audio/*" className="hidden" onChange={(e) => setAudioFile(e.target.files?.[0] ?? null)} />
                      </label>
                    </div>
                  )}
                </div>
              </div>

              {error && (
                <div className="px-4 py-3 rounded-xl text-sm" style={{ background: 'rgba(251,113,133,0.1)', border: '1px solid rgba(251,113,133,0.2)', color: '#fb7185' }}>
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={!audioFile}
                className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl text-sm font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed hover:scale-[1.01] active:scale-[0.99]"
                style={audioFile ? { background: 'linear-gradient(90deg, #f59e0b 0%, #fbbf24 25%, #f59e0b 50%, #fbbf24 75%, #f59e0b 100%)', backgroundSize: '400% auto', color: '#07071a' } : { background: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.3)' }}
              >
                <UploadIcon />
                Process uploaded audio
              </button>
              <p className="text-center text-xs" style={{ color: 'rgba(255,255,255,0.25)' }}>
                Transcribed and translated using Sarvam AI
              </p>
            </div>
          )}
        </div>
      </div>
    </form>
  );
}
