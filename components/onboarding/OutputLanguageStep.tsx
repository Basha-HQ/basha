'use client';

interface Props {
  onNext: () => void;
  onBack: () => void;
}

export function OutputLanguageStep({ onNext, onBack }: Props) {
  return (
    <div>
      <h2 className="text-2xl font-bold text-white mb-2">You always get two transcripts</h2>
      <p className="text-sm mb-8" style={{ color: 'rgba(255,255,255,0.5)' }}>
        Basha preserves the original and generates a clean English version — automatically.
      </p>

      {/* Visual explanation */}
      <div
        className="rounded-2xl overflow-hidden mb-8"
        style={{ border: '1px solid rgba(255,255,255,0.08)', background: '#0d0d22' }}
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-white/10">
          {/* Original side */}
          <div className="p-5">
            <div className="flex items-center gap-2 mb-4">
              <span className="text-xs font-bold uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.35)' }}>
                Original
              </span>
              <span
                className="text-xs px-2 py-0.5 rounded font-medium"
                style={{ background: 'rgba(245,158,11,0.12)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.3)' }}
              >
                Tanglish
              </span>
            </div>
            <div className="space-y-3">
              {[
                { s: 'Priya', msg: 'Budget konjam tight — next sprint push pannalaam.' },
                { s: 'Karthik', msg: 'Seri, feature freeze Monday.' },
              ].map((e, i) => (
                <div key={i} className="flex gap-2">
                  <div
                    className="w-6 h-6 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-bold"
                    style={{ background: 'rgba(245,158,11,0.15)', color: '#f59e0b' }}
                  >
                    {e.s[0]}
                  </div>
                  <p className="text-xs leading-relaxed pt-0.5" style={{ color: 'rgba(255,255,255,0.75)' }}>
                    {e.msg}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* English side */}
          <div className="p-5" style={{ background: 'rgba(99,102,241,0.04)' }}>
            <div className="flex items-center gap-2 mb-4">
              <span className="text-xs font-bold uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.35)' }}>
                English
              </span>
              <span className="text-xs px-2 py-0.5 rounded font-medium text-indigo-300" style={{ background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.25)' }}>
                translated
              </span>
            </div>
            <div className="space-y-3">
              {[
                { s: 'Priya', msg: 'Budget is tight — let\'s push to next sprint.' },
                { s: 'Karthik', msg: 'Okay, feature freeze on Monday.' },
              ].map((e, i) => (
                <div key={i} className="flex gap-2">
                  <div
                    className="w-6 h-6 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-bold text-indigo-200"
                    style={{ background: 'rgba(99,102,241,0.2)' }}
                  >
                    {e.s[0]}
                  </div>
                  <p className="text-xs leading-relaxed pt-0.5 text-indigo-100/80">{e.msg}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer note */}
        <div
          className="px-5 py-3 text-xs border-t"
          style={{ borderColor: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.35)', background: 'rgba(255,255,255,0.02)' }}
        >
          ★ No competitor offers dual-output transcripts for code-mixed meetings
        </div>
      </div>

      {/* Output language selector — English pre-selected */}
      <div
        className="flex items-center gap-3 p-4 rounded-xl mb-8"
        style={{ background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)' }}
      >
        <div
          className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0"
          style={{ background: '#6366f1' }}
        >
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="white" strokeWidth={3}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <div>
          <div className="text-sm font-semibold text-white">English output (default)</div>
          <div className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.4)' }}>
            Clean English transcript delivered alongside every original
          </div>
        </div>
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
          Got it →
        </button>
      </div>
    </div>
  );
}
