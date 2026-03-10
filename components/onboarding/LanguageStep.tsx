'use client';

import { useState } from 'react';
import { transcriptPreviews } from './transcriptPreviews';

const LANGUAGES = [
  { code: 'en', label: 'English', native: 'English', mixed: null },
  { code: 'hi', label: 'Hindi', native: 'हिन्दी', mixed: 'Hinglish' },
  { code: 'ta', label: 'Tamil', native: 'தமிழ்', mixed: 'Tanglish' },
  { code: 'te', label: 'Telugu', native: 'తెలుగు', mixed: 'Teluglish' },
  { code: 'kn', label: 'Kannada', native: 'ಕನ್ನಡ', mixed: 'Kanglish' },
];

interface Props {
  selected: string[];
  onChange: (langs: string[]) => void;
  onNext: () => void;
}

export function LanguageStep({ selected, onChange, onNext }: Props) {
  const [preview, setPreview] = useState<string | null>(null);

  function toggle(code: string) {
    const next = selected.includes(code)
      ? selected.filter((c) => c !== code)
      : [...selected, code];
    onChange(next);
    if (!selected.includes(code) && transcriptPreviews[code]) {
      setPreview(code);
    } else if (selected.includes(code) && preview === code) {
      const remaining = next.find((c) => transcriptPreviews[c]);
      setPreview(remaining ?? null);
    }
  }

  const previewData = preview ? transcriptPreviews[preview] : null;
  const previewLang = LANGUAGES.find((l) => l.code === preview);

  return (
    <div>
      <h2 className="text-2xl font-bold text-white mb-2">How does your team speak?</h2>
      <p className="text-sm mb-8" style={{ color: 'rgba(255,255,255,0.5)' }}>
        Select all languages used in your meetings. Basha captures code-mixed speech natively.
      </p>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-8">
        {LANGUAGES.map((lang) => {
          const isSelected = selected.includes(lang.code);
          return (
            <button
              key={lang.code}
              onClick={() => toggle(lang.code)}
              className="relative p-4 rounded-2xl text-left transition-all duration-150 cursor-pointer"
              style={{
                background: isSelected ? 'rgba(245,158,11,0.15)' : 'rgba(255,255,255,0.04)',
                border: isSelected ? '1.5px solid rgba(245,158,11,0.6)' : '1.5px solid rgba(255,255,255,0.08)',
              }}
            >
              <div className="font-bold text-white text-sm">{lang.label}</div>
              <div className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.35)' }}>{lang.native}</div>
              {lang.mixed && (
                <div
                  className="mt-2 text-xs font-semibold px-2 py-0.5 rounded-full inline-block"
                  style={{ background: 'rgba(245,158,11,0.15)', color: '#f59e0b' }}
                >
                  {lang.mixed}
                </div>
              )}
              {isSelected && (
                <div
                  className="absolute top-2 right-2 w-5 h-5 rounded-full flex items-center justify-center"
                  style={{ background: '#f59e0b' }}
                >
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="#07071a" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Live transcript preview */}
      {previewData && previewLang && (
        <div
          className="rounded-2xl overflow-hidden mb-8"
          style={{ border: '1px solid rgba(255,255,255,0.08)', background: '#0d0d22' }}
        >
          <div
            className="flex items-center gap-3 px-4 py-3 border-b"
            style={{ borderColor: 'rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.02)' }}
          >
            <span className="text-xs font-mono" style={{ color: 'rgba(255,255,255,0.25)' }}>
              basha · live preview · {previewLang.mixed ?? previewLang.label}
            </span>
            <span
              className="ml-auto text-xs font-semibold px-2.5 py-0.5 rounded-full"
              style={{ background: 'rgba(245,158,11,0.15)', color: '#f59e0b' }}
            >
              {previewLang.mixed ?? previewLang.label}
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-white/10">
            <div className="p-4">
              <div className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: 'rgba(255,255,255,0.3)' }}>
                Original
              </div>
              <div className="space-y-3">
                {previewData.map((e, i) => (
                  <div key={i} className="flex gap-2">
                    <div
                      className="w-6 h-6 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-bold"
                      style={{ background: 'rgba(245,158,11,0.15)', color: '#f59e0b' }}
                    >
                      {e.speaker[0]}
                    </div>
                    <p className="text-xs leading-relaxed pt-0.5" style={{ color: 'rgba(255,255,255,0.75)' }}>
                      {e.original}
                    </p>
                  </div>
                ))}
              </div>
            </div>
            <div className="p-4" style={{ background: 'rgba(99,102,241,0.04)' }}>
              <div className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: 'rgba(255,255,255,0.3)' }}>
                English
              </div>
              <div className="space-y-3">
                {previewData.map((e, i) => (
                  <div key={i} className="flex gap-2">
                    <div
                      className="w-6 h-6 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-bold text-indigo-200"
                      style={{ background: 'rgba(99,102,241,0.2)' }}
                    >
                      {e.speaker[0]}
                    </div>
                    <p className="text-xs leading-relaxed pt-0.5 text-indigo-100/80">{e.english}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      <button
        onClick={onNext}
        disabled={selected.length === 0}
        className="w-full py-3.5 rounded-xl font-bold text-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed btn-amber-shimmer"
        style={{ color: '#07071a' }}
      >
        Continue →
      </button>
    </div>
  );
}
