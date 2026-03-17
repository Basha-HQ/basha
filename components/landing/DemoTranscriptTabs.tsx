'use client';

import { useState } from 'react';
import { StardustButton } from '@/components/ui/stardust-button';

type TabKey = 'tanglish' | 'hinglish' | 'teluglish' | 'kanglish';

interface Entry {
  time: string;
  speaker: string;
  original: string;
  english: string;
}

interface Demo {
  label: string;
  subtitle: string;
  accent: string;
  bgAccent: string;
  entries: Entry[];
}

const demos: Record<TabKey, Demo> = {
  tanglish: {
    label: 'Tanglish',
    subtitle: 'Tamil + English',
    accent: '#f59e0b',
    bgAccent: 'rgba(245,158,11,0.12)',
    entries: [
      {
        time: '10:14',
        speaker: 'Priya',
        original: 'Next week launch pannalam but marketing budget konjam increase panna vendiyirukkum.',
        english: 'We can launch next week but the marketing budget may need to increase.',
      },
      {
        time: '10:17',
        speaker: 'Karthik',
        original: 'Feature ready aagidu. QA testing mattum pending — rendum fix pannadha irukaen.',
        english: 'The feature is ready. Only QA testing remains — I have two fixes pending.',
      },
      {
        time: '10:21',
        speaker: 'Priya',
        original: 'Marketing team kitta check panni budget approval eduthutu proceed pannunga.',
        english: 'Check with the marketing team, get budget approval, then proceed.',
      },
    ],
  },
  hinglish: {
    label: 'Hinglish',
    subtitle: 'Hindi + English',
    accent: '#a78bfa',
    bgAccent: 'rgba(167,139,250,0.12)',
    entries: [
      {
        time: '14:32',
        speaker: 'Rahul',
        original: 'Client call mein unhone bola ki pricing thodi zyada hai unke liye.',
        english: 'In the client call they said the pricing is a bit high for them.',
      },
      {
        time: '14:35',
        speaker: 'Neha',
        original: 'To kya karna chahiye? Discount offer karein ya better package de?',
        english: 'So what should we do? Offer a discount or give a better package?',
      },
      {
        time: '14:38',
        speaker: 'Rahul',
        original: "Main kal unhe call karta hoon — package restructure karke dikhate hain.",
        english: "I'll call them tomorrow — let's show them a restructured package.",
      },
    ],
  },
  teluglish: {
    label: 'Teluglish',
    subtitle: 'Telugu + English',
    accent: '#34d399',
    bgAccent: 'rgba(52,211,153,0.12)',
    entries: [
      {
        time: '09:08',
        speaker: 'Vikram',
        original: 'Database migration complete aipoindi. Production ki push cheyyadaniki ready ga unnamu.',
        english: 'Database migration is complete. We are ready to push to production.',
      },
      {
        time: '09:11',
        speaker: 'Ananya',
        original: 'Load testing chesamu — peak load lo kuda system stable ga undi.',
        english: 'We ran load testing — the system is stable even under peak load.',
      },
      {
        time: '09:15',
        speaker: 'Vikram',
        original: "Friday ki deploy cheyyochu. Rollback plan kuda ready ga pettukunnamu.",
        english: "We can deploy on Friday. We've also prepared a rollback plan.",
      },
    ],
  },
  kanglish: {
    label: 'Kanglish',
    subtitle: 'Kannada + English',
    accent: '#fb7185',
    bgAccent: 'rgba(251,113,133,0.12)',
    entries: [
      {
        time: '11:44',
        speaker: 'Suresh',
        original: 'Q3 budget review madidivi — marketing spend expected kante 18% jaasti aagide.',
        english: 'We reviewed the Q3 budget — marketing spend is 18% over expected.',
      },
      {
        time: '11:47',
        speaker: 'Deepa',
        original: 'Cause yenu andre digital campaigns ROI adu expect madiddu barala illa.',
        english: 'Digital campaigns did not deliver the expected ROI.',
      },
      {
        time: '11:52',
        speaker: 'Suresh',
        original: "Next quarter innu tightly budget plan maadona — weekly tracking add maadona.",
        english: "Let's plan the budget more tightly next quarter with weekly tracking.",
      },
    ],
  },
};

const tabs: TabKey[] = ['tanglish', 'hinglish', 'teluglish', 'kanglish'];

export function DemoTranscriptTabs() {
  const [active, setActive] = useState<TabKey>('tanglish');
  const demo = demos[active];

  return (
    <div className="w-full max-w-5xl mx-auto">
      {/* Tab bar */}
      <div className="flex gap-3 mb-6 flex-wrap">
        {tabs.map((tab) => {
          const isActive = tab === active;
          const d = demos[tab];
          return (
            <StardustButton
              key={tab}
              size="sm"
              accentColor={d.accent}
              inactive={!isActive}
              onClick={() => setActive(tab)}
            >
              {d.label}
              <span style={{ opacity: 0.65, fontWeight: 400, fontSize: '0.85em' }}>{d.subtitle}</span>
            </StardustButton>
          );
        })}
      </div>

      {/* Transcript card */}
      <div
        className="rounded-2xl overflow-hidden"
        style={{ border: '1px solid rgba(255,255,255,0.08)', background: '#0d0d22' }}
      >
        {/* Window chrome */}
        <div
          className="flex items-center gap-3 px-5 py-3.5 border-b"
          style={{ borderColor: 'rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.03)' }}
        >
          <div className="flex gap-1.5">
            <div className="w-3 h-3 rounded-full" style={{ background: '#ff5f57' }} />
            <div className="w-3 h-3 rounded-full" style={{ background: '#febc2e' }} />
            <div className="w-3 h-3 rounded-full" style={{ background: '#28c840' }} />
          </div>
          <span className="text-xs font-mono" style={{ color: 'rgba(255,255,255,0.25)' }}>
            basha · live transcript · {demo.label} meeting
          </span>
          <span
            className="ml-auto text-xs px-2.5 py-0.5 rounded-full font-semibold"
            style={{ background: demo.bgAccent, color: demo.accent }}
          >
            {demo.subtitle}
          </span>
        </div>

        {/* Two-column layout */}
        <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-white/10">
          {/* Original */}
          <div className="p-6 md:p-8">
            <div className="flex items-center gap-2 mb-6">
              <span className="text-xs font-bold uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.35)' }}>
                Original
              </span>
              <span
                className="text-xs px-2 py-0.5 rounded font-medium"
                style={{ background: demo.bgAccent, color: demo.accent, border: `1px solid ${demo.accent}30` }}
              >
                {demo.label}
              </span>
            </div>
            <div className="space-y-6">
              {demo.entries.map((entry, i) => (
                <div key={i} className="flex gap-3">
                  <div
                    className="w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-bold mt-0.5"
                    style={{ background: demo.bgAccent, color: demo.accent, border: `1px solid ${demo.accent}30` }}
                  >
                    {entry.speaker[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2 mb-1.5">
                      <span className="text-xs font-semibold" style={{ color: 'rgba(255,255,255,0.65)' }}>
                        {entry.speaker}
                      </span>
                      <span className="text-xs font-mono" style={{ color: 'rgba(255,255,255,0.22)' }}>
                        {entry.time}
                      </span>
                    </div>
                    <p className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.82)' }}>
                      {entry.original}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* English translation */}
          <div className="p-6 md:p-8" style={{ background: 'rgba(99,102,241,0.04)' }}>
            <div className="flex items-center gap-2 mb-6">
              <span className="text-xs font-bold uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.35)' }}>
                English
              </span>
              <span className="text-xs px-2 py-0.5 rounded font-medium text-indigo-300" style={{ background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.25)' }}>
                translated
              </span>
            </div>
            <div className="space-y-6">
              {demo.entries.map((entry, i) => (
                <div key={i} className="flex gap-3">
                  <div className="w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-bold mt-0.5 text-indigo-200" style={{ background: 'rgba(99,102,241,0.2)', border: '1px solid rgba(99,102,241,0.3)' }}>
                    {entry.speaker[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2 mb-1.5">
                      <span className="text-xs font-semibold" style={{ color: 'rgba(255,255,255,0.65)' }}>
                        {entry.speaker}
                      </span>
                      <span className="text-xs font-mono" style={{ color: 'rgba(255,255,255,0.22)' }}>
                        {entry.time}
                      </span>
                    </div>
                    <p className="text-sm leading-relaxed text-indigo-100/90">
                      {entry.english}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
