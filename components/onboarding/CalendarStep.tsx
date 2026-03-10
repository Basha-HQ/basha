'use client';

interface Props {
  onConnect: () => void;
  onSkip: () => void;
  onBack: () => void;
  connecting: boolean;
}

export function CalendarStep({ onConnect, onSkip, onBack, connecting }: Props) {
  return (
    <div>
      <h2 className="text-2xl font-bold text-white mb-2">Auto-join your meetings</h2>
      <p className="text-sm mb-8" style={{ color: 'rgba(255,255,255,0.5)' }}>
        Connect Google Calendar and Basha will automatically join every meeting — no link pasting needed.
      </p>

      {/* Benefits */}
      <div className="space-y-3 mb-8">
        {[
          { icon: '📅', title: 'See upcoming meetings', body: 'Your dashboard shows all meetings scheduled today and this week.' },
          { icon: '🤖', title: 'Basha joins automatically', body: 'Toggle auto-join and Basha enters meetings 1 minute before they start.' },
          { icon: '🔔', title: 'Pre-meeting reminders', body: 'Get notified 5 minutes before Basha joins your call.' },
        ].map((item, i) => (
          <div
            key={i}
            className="flex gap-4 p-4 rounded-xl"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}
          >
            <span className="text-2xl flex-shrink-0">{item.icon}</span>
            <div>
              <div className="text-sm font-semibold text-white">{item.title}</div>
              <div className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.4)' }}>{item.body}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Connect button */}
      <button
        onClick={onConnect}
        disabled={connecting}
        className="w-full flex items-center justify-center gap-3 py-3.5 rounded-xl font-bold text-sm mb-3 transition-all disabled:opacity-60"
        style={{ background: 'rgba(255,255,255,0.9)', color: '#1a1a2e' }}
      >
        {connecting ? (
          <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
          </svg>
        ) : (
          <GoogleIcon />
        )}
        {connecting ? 'Connecting...' : 'Connect Google Calendar'}
      </button>

      <div className="flex gap-3">
        <button
          onClick={onBack}
          className="px-5 py-3 rounded-xl text-sm font-medium transition-all"
          style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.55)', border: '1px solid rgba(255,255,255,0.1)' }}
        >
          ← Back
        </button>
        <button
          onClick={onSkip}
          className="flex-1 py-3 rounded-xl text-sm font-medium transition-all"
          style={{ background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.4)', border: '1px solid rgba(255,255,255,0.08)' }}
        >
          Skip for now →
        </button>
      </div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 24 24">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </svg>
  );
}
