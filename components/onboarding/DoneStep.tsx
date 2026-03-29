'use client';

interface Props {
  onBack: () => void;
  saving: boolean;
  error: boolean;
  onRetry: () => void;
}

const FREE_FEATURES = [
  'Unlimited meetings recorded',
  'Dual-output transcript (original + English)',
  'AI summary with action items',
  'Keyword search in transcripts',
  'TXT download',
  '30-day transcript storage',
];

const PAID_FEATURES = [
  'Everything in free',
  'Lifetime transcript storage',
  'PDF export',
  'Global search across all meetings',
  'Google Calendar auto-join',
  'Priority processing',
];

export function DoneStep({ onBack, saving, error, onRetry }: Props) {
  return (
    <div>
      <div className="text-center mb-8">
        <div
          className="w-16 h-16 rounded-2xl flex items-center justify-center font-black text-2xl mx-auto mb-4"
          style={{ background: 'linear-gradient(135deg, #f59e0b, #f97316)', color: '#07071a' }}
        >
          B
        </div>
        <h2 className="text-2xl font-bold text-white mb-2">
          {saving ? 'Setting up your account…' : error ? 'Something went wrong' : 'One step left'}
        </h2>
        <p className="text-sm" style={{ color: 'rgba(255,255,255,0.5)' }}>
          {saving
            ? 'Saving your preferences'
            : error
            ? 'We couldn\u2019t save your preferences. Please try again.'
            : 'Install the Basha Chrome extension to start recording.'}
        </p>
      </div>

      {!saving && !error && (
        <>
          {/* Plan comparison */}
          <div
            className="rounded-2xl overflow-hidden mb-8"
            style={{ border: '1px solid rgba(255,255,255,0.08)' }}
          >
            <div className="grid grid-cols-2 divide-x divide-white/10">
              {/* Free */}
              <div className="p-5 flex flex-col">
                <div className="text-xs font-bold uppercase tracking-widest mb-1" style={{ color: 'rgba(255,255,255,0.35)' }}>
                  Free
                </div>
                <div className="text-xl font-black text-white mb-4">₹0</div>
                <ul className="space-y-2 flex-1">
                  {FREE_FEATURES.map((f, i) => (
                    <li key={i} className="flex items-start gap-2 text-xs" style={{ color: 'rgba(255,255,255,0.6)' }}>
                      <svg className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                      {f}
                    </li>
                  ))}
                </ul>
                <button
                  onClick={() => { window.location.href = '/dashboard'; }}
                  className="mt-4 w-full py-2 rounded-lg text-xs font-bold"
                  style={{ background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.7)', border: '1px solid rgba(255,255,255,0.12)' }}
                >
                  Get Started
                </button>
              </div>

              {/* Paid */}
              <div className="p-5 flex flex-col" style={{ background: 'rgba(245,158,11,0.05)' }}>
                <div className="text-xs font-bold uppercase tracking-widest mb-1" style={{ color: '#f59e0b' }}>
                  Pro
                </div>
                <div className="text-xl font-black text-white mb-4">
                  ₹499
                  <span className="text-sm font-normal ml-1" style={{ color: 'rgba(255,255,255,0.35)' }}>/mo</span>
                </div>
                <ul className="space-y-2 flex-1">
                  {PAID_FEATURES.map((f, i) => (
                    <li key={i} className="flex items-start gap-2 text-xs" style={{ color: 'rgba(255,255,255,0.6)' }}>
                      <svg className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="#f59e0b" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                      {f}
                    </li>
                  ))}
                </ul>
                <div
                  className="mt-4 w-full py-2 rounded-lg text-xs font-bold text-center"
                  style={{ background: 'rgba(245,158,11,0.08)', color: 'rgba(245,158,11,0.5)', border: '1px solid rgba(245,158,11,0.15)' }}
                >
                  Coming Soon
                </div>
              </div>
            </div>
          </div>

          {/* CTAs */}
          <button
            onClick={() => { window.location.href = '/settings#integrations'; }}
            className="block w-full text-center py-3.5 rounded-xl font-bold text-sm mb-3 btn-amber-shimmer"
            style={{ color: '#07071a' }}
          >
            Set up Chrome Extension →
          </button>
          <button
            onClick={() => { window.location.href = '/dashboard'; }}
            className="block w-full text-center py-3 rounded-xl text-sm font-medium"
            style={{ background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.5)', border: '1px solid rgba(255,255,255,0.08)' }}
          >
            Go to dashboard
          </button>

          <div className="mt-4 text-center">
            <button
              onClick={onBack}
              className="text-xs"
              style={{ color: 'rgba(255,255,255,0.3)' }}
            >
              ← Back
            </button>
          </div>
        </>
      )}

      {saving && (
        <div className="flex justify-center">
          <svg className="animate-spin w-8 h-8" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="#f59e0b" strokeWidth="4" />
            <path className="opacity-75" fill="#f59e0b" d="M4 12a8 8 0 018-8v8H4z" />
          </svg>
        </div>
      )}

      {error && !saving && (
        <div className="text-center">
          <button
            onClick={onRetry}
            className="px-6 py-3 rounded-xl font-bold text-sm btn-amber-shimmer"
            style={{ color: '#07071a' }}
          >
            Try again
          </button>
          <div className="mt-4">
            <button
              onClick={onBack}
              className="text-xs"
              style={{ color: 'rgba(255,255,255,0.3)' }}
            >
              ← Back
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
