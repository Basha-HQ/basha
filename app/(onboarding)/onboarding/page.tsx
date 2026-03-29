'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { LanguageStep } from '@/components/onboarding/LanguageStep';
import { DoneStep } from '@/components/onboarding/DoneStep';

const TOTAL_STEPS = 2;

const STEP_LABELS = ['Languages', 'Done'];

export default function OnboardingPage() {
  const { update } = useSession();
  const [step, setStep] = useState(1);
  const [languages, setLanguages] = useState<string[]>(['en']);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(false);

  async function saveAndFinish(overrideLangs?: string[]) {
    setSaving(true);
    setSaveError(false);
    setStep(2);
    try {
      const res = await fetch('/api/onboarding', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          preferred_languages: overrideLangs ?? languages,
          output_language: 'en',
          meeting_platform: 'both',
        }),
      });
      if (!res.ok) throw new Error('Failed to save preferences');
      await update({ onboardingCompleted: true });
    } catch {
      setSaveError(true);
    } finally {
      setSaving(false);
    }
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
              onNext={() => saveAndFinish()}
            />
          )}
          {step === 2 && (
            <DoneStep
              onBack={() => setStep(1)}
              saving={saving}
              error={saveError}
              onRetry={() => saveAndFinish()}
            />
          )}
        </div>
      </div>
    </div>
  );
}
