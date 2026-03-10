'use client';

const PLATFORMS = [
  {
    value: 'google_meet',
    label: 'Google Meet',
    description: 'Basha joins via bot — works with all Google Workspace accounts',
    icon: (
      <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none">
        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
      </svg>
    ),
  },
  {
    value: 'zoom',
    label: 'Zoom',
    description: 'Paste your Zoom meeting link and Basha joins automatically',
    icon: (
      <svg className="w-6 h-6" viewBox="0 0 24 24" fill="#2D8CFF">
        <path d="M4.5 8.5C4.5 6.29 6.29 4.5 8.5 4.5h7c2.21 0 4 1.79 4 4v7c0 2.21-1.79 4-4 4h-7C6.29 19.5 4.5 17.71 4.5 15.5v-7zm9.5 1.5v4l4-2-4-2z" />
      </svg>
    ),
  },
  {
    value: 'both',
    label: 'Both',
    description: 'Use Basha with Google Meet and Zoom — works seamlessly with either',
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="#f59e0b" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
];

interface Props {
  selected: string;
  onChange: (platform: string) => void;
  onNext: () => void;
  onBack: () => void;
}

export function PlatformStep({ selected, onChange, onNext, onBack }: Props) {
  return (
    <div>
      <h2 className="text-2xl font-bold text-white mb-2">Which meeting platform do you use?</h2>
      <p className="text-sm mb-8" style={{ color: 'rgba(255,255,255,0.5)' }}>
        Basha joins as a bot and records your meeting. Just paste the link — no installation needed.
      </p>

      <div className="space-y-3 mb-8">
        {PLATFORMS.map((p) => {
          const isSelected = selected === p.value;
          return (
            <button
              key={p.value}
              onClick={() => onChange(p.value)}
              className="w-full flex items-center gap-4 p-4 rounded-2xl text-left transition-all duration-150 cursor-pointer"
              style={{
                background: isSelected ? 'rgba(245,158,11,0.1)' : 'rgba(255,255,255,0.04)',
                border: isSelected ? '1.5px solid rgba(245,158,11,0.5)' : '1.5px solid rgba(255,255,255,0.08)',
              }}
            >
              <div
                className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: 'rgba(255,255,255,0.06)' }}
              >
                {p.icon}
              </div>
              <div className="flex-1">
                <div className="font-semibold text-white text-sm">{p.label}</div>
                <div className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.4)' }}>{p.description}</div>
              </div>
              <div
                className="w-5 h-5 rounded-full flex-shrink-0 flex items-center justify-center"
                style={{
                  background: isSelected ? '#f59e0b' : 'transparent',
                  border: isSelected ? 'none' : '1.5px solid rgba(255,255,255,0.2)',
                }}
              >
                {isSelected && (
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="#07071a" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </div>
            </button>
          );
        })}
      </div>

      <div className="flex gap-3">
        <button
          onClick={onBack}
          className="px-5 py-3 rounded-xl text-sm font-medium transition-all"
          style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.55)', border: '1px solid rgba(255,255,255,0.1)' }}
        >
          ← Back
        </button>
        <button
          onClick={onNext}
          className="flex-1 py-3 rounded-xl font-bold text-sm transition-all btn-amber-shimmer"
          style={{ color: '#07071a' }}
        >
          Continue →
        </button>
      </div>
    </div>
  );
}
