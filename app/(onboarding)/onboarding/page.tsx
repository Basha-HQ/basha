'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { LanguageStep } from '@/components/onboarding/LanguageStep';
import { OutputLanguageStep } from '@/components/onboarding/OutputLanguageStep';
import { PlatformStep } from '@/components/onboarding/PlatformStep';
import { CalendarStep } from '@/components/onboarding/CalendarStep';
import { DoneStep } from '@/components/onboarding/DoneStep';

const TOTAL_STEPS = 5;

const STEP_LABELS = ['Languages', 'Output', 'Platform', 'Calendar', 'Done'];

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [languages, setLanguages] = useState<string[]>([]);
  const [platform, setPlatform] = useState('both');
  const [saving, setSaving] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [calendarOAuthError, setCalendarOAuthError] = useState<string | null>(null);

  // On mount: handle returns from Google Calendar OAuth (?cal=1 success, ?error=... failure)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);

    if (params.get('cal') === '1') {
      // Successful OAuth redirect — restore state and finish
      let restoredLangs: string[] = [];
      let restoredPlatform = 'both';
      try {
        const saved = localStorage.getItem('basha_onboarding');
        if (saved) {
          const parsed = JSON.parse(saved) as { languages?: string[]; platform?: string };
          restoredLangs = parsed.languages ?? [];
          restoredPlatform = parsed.platform ?? 'both';
          localStorage.removeItem('basha_onboarding');
          setLanguages(restoredLangs);
          setPlatform(restoredPlatform);
        }
      } catch { /* ignore */ }
      saveAndFinish(restoredLangs, restoredPlatform);
    } else if (params.get('error')) {
      // OAuth returned an error — restore to step 4 and show error
      try {
        const saved = localStorage.getItem('basha_onboarding');
        if (saved) {
          const parsed = JSON.parse(saved) as { languages?: string[]; platform?: string };
          setLanguages(parsed.languages ?? []);
          setPlatform(parsed.platform ?? 'both');
          localStorage.removeItem('basha_onboarding');
        }
      } catch { /* ignore */ }
      setStep(4);
      setCalendarOAuthError(
        'Google Calendar connection failed. Make sure the Google Calendar API is enabled in your Google Cloud project and the calendar.readonly scope is approved on the OAuth consent screen.'
      );
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function saveAndFinish(overrideLangs?: string[], overridePlatform?: string) {
    setSaving(true);
    setStep(5);
    try {
      await fetch('/api/onboarding', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          preferred_languages: overrideLangs ?? languages,
          output_language: 'en',
          meeting_platform: overridePlatform ?? platform,
        }),
      });
    } catch {
      // Silent fail — user can still proceed
    } finally {
      setSaving(false);
    }
  }

  function handleCalendarConnect() {
    // Save current step state to localStorage before OAuth redirect
    try {
      localStorage.setItem('basha_onboarding', JSON.stringify({ languages, platform }));
    } catch { /* ignore */ }
    setConnecting(true);
    const callbackUrl = encodeURIComponent('/onboarding?cal=1');
    window.location.href = `/api/auth/signin/google?callbackUrl=${callbackUrl}`;
  }

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ backgroundColor: '#07071a' }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-5 border-b" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
        <Link href="/" className="flex items-center gap-2.5">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm"
            style={{ background: 'linear-gradient(135deg, #f59e0b, #f97316)', color: '#07071a' }}
          >
            B
          </div>
          <span className="font-bold text-base tracking-tight text-white">Basha</span>
        </Link>

        {/* Step dots */}
        <div className="flex items-center gap-2">
          {Array.from({ length: TOTAL_STEPS }, (_, i) => (
            <div
              key={i}
              className="rounded-full transition-all duration-300"
              style={{
                width: i + 1 === step ? '20px' : '8px',
                height: '8px',
                background: i + 1 < step
                  ? '#f59e0b'
                  : i + 1 === step
                  ? '#f59e0b'
                  : 'rgba(255,255,255,0.15)',
              }}
            />
          ))}
        </div>

        <div className="text-xs font-medium" style={{ color: 'rgba(255,255,255,0.3)' }}>
          Step {step} of {TOTAL_STEPS}
        </div>
      </div>

      {/* Step label strip */}
      <div className="flex justify-center gap-6 py-4 border-b" style={{ borderColor: 'rgba(255,255,255,0.04)' }}>
        {STEP_LABELS.map((label, i) => (
          <span
            key={i}
            className="text-xs font-medium"
            style={{
              color: i + 1 === step
                ? '#f59e0b'
                : i + 1 < step
                ? 'rgba(255,255,255,0.4)'
                : 'rgba(255,255,255,0.15)',
            }}
          >
            {label}
          </span>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 flex items-start justify-center px-6 py-10">
        <div className="w-full max-w-lg">
          {step === 1 && (
            <LanguageStep
              selected={languages}
              onChange={setLanguages}
              onNext={() => setStep(2)}
            />
          )}
          {step === 2 && (
            <OutputLanguageStep
              onNext={() => setStep(3)}
              onBack={() => setStep(1)}
            />
          )}
          {step === 3 && (
            <PlatformStep
              selected={platform}
              onChange={setPlatform}
              onNext={() => setStep(4)}
              onBack={() => setStep(2)}
            />
          )}
          {step === 4 && (
            <CalendarStep
              onConnect={handleCalendarConnect}
              onSkip={() => saveAndFinish()}
              onBack={() => setStep(3)}
              connecting={connecting}
              oauthError={calendarOAuthError}
            />
          )}
          {step === 5 && (
            <DoneStep
              onBack={() => setStep(4)}
              saving={saving}
            />
          )}
        </div>
      </div>
    </div>
  );
}
