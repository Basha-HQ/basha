import Link from 'next/link';

export const metadata = { title: 'Pricing — Basha' };

const FREE = [
  { label: 'Meetings recorded', value: 'Unlimited' },
  { label: 'Transcript storage', value: '30 days' },
  { label: 'Code-mixed languages', value: 'All 5' },
  { label: 'Dual-output transcript', value: true },
  { label: 'AI summary (topics + decisions + actions)', value: true },
  { label: 'Keyword search', value: true },
  { label: 'TXT download', value: true },
  { label: 'PDF export', value: false },
  { label: 'Global search across all meetings', value: false },
  { label: 'Google Calendar auto-join', value: false },
  { label: 'Priority processing', value: false },
];

const PAID = [
  { label: 'Meetings recorded', value: 'Unlimited' },
  { label: 'Transcript storage', value: 'Forever' },
  { label: 'Code-mixed languages', value: 'All 5' },
  { label: 'Dual-output transcript', value: true },
  { label: 'AI summary (topics + decisions + actions)', value: true },
  { label: 'Keyword search', value: true },
  { label: 'TXT download', value: true },
  { label: 'PDF export', value: true },
  { label: 'Global search across all meetings', value: true },
  { label: 'Google Calendar auto-join', value: true },
  { label: 'Priority processing', value: true },
];

function Cell({ value }: { value: string | boolean }) {
  if (typeof value === 'string') {
    return <span className="text-sm font-semibold text-white">{value}</span>;
  }
  if (value) {
    return (
      <svg className="w-5 h-5 text-emerald-400 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
      </svg>
    );
  }
  return (
    <svg className="w-5 h-5 mx-auto" fill="none" viewBox="0 0 24 24" stroke="rgba(255,255,255,0.2)" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}

export default function PricingPage() {
  return (
    <div className="min-h-screen" style={{ backgroundColor: '#07071a' }}>
      {/* Nav */}
      <div className="sticky top-0 z-50 w-full" style={{ backgroundColor: 'rgba(7,7,26,0.92)', backdropFilter: 'blur(12px)', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
        <nav className="flex items-center justify-between px-6 py-4 max-w-6xl mx-auto">
          <Link href="/" className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm" style={{ background: 'linear-gradient(135deg, #f59e0b, #f97316)', color: '#07071a' }}>
              B
            </div>
            <span className="font-bold text-xl tracking-tight text-white">Basha</span>
          </Link>
          <div className="flex items-center gap-3">
            <Link href="/login" className="text-sm font-medium" style={{ color: 'rgba(255,255,255,0.5)' }}>
              Sign in
            </Link>
            <Link href="/signup" className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-sm font-bold btn-amber-shimmer" style={{ color: '#07071a' }}>
              Get started free
            </Link>
          </div>
        </nav>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-20">
        {/* Header */}
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold mb-6" style={{ background: 'rgba(245,158,11,0.12)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.25)' }}>
            Simple, honest pricing
          </div>
          <h1 className="font-black leading-tight mb-4" style={{ fontSize: 'clamp(2rem, 5vw, 3rem)', color: '#ffffff' }}>
            Start free. Upgrade when<br />you need more.
          </h1>
          <p className="text-lg" style={{ color: 'rgba(255,255,255,0.45)' }}>
            No credit card required. No hidden fees.
          </p>
        </div>

        {/* Plan cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
          {/* Free */}
          <div className="rounded-2xl p-8" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <div className="text-xs font-bold uppercase tracking-widest mb-4" style={{ color: 'rgba(255,255,255,0.35)' }}>Free</div>
            <div className="flex items-end gap-1 mb-2">
              <span className="text-4xl font-black text-white">₹0</span>
            </div>
            <p className="text-sm mb-8" style={{ color: 'rgba(255,255,255,0.4)' }}>Forever free. No card needed.</p>
            <Link
              href="/signup"
              className="block w-full text-center py-3 rounded-xl text-sm font-bold mb-8"
              style={{ background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.7)', border: '1px solid rgba(255,255,255,0.1)' }}
            >
              Get started free
            </Link>
            <ul className="space-y-3">
              {FREE.map((f, i) => (
                <li key={i} className="flex items-center justify-between gap-2">
                  <span className="text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>{f.label}</span>
                  <Cell value={f.value} />
                </li>
              ))}
            </ul>
          </div>

          {/* Pro */}
          <div className="rounded-2xl p-8 relative" style={{ background: 'rgba(245,158,11,0.06)', border: '1.5px solid rgba(245,158,11,0.3)' }}>
            <div className="absolute -top-3 left-1/2 -translate-x-1/2">
              <span className="text-xs font-bold px-3 py-1 rounded-full btn-amber-shimmer" style={{ color: '#07071a' }}>
                Most Popular
              </span>
            </div>
            <div className="text-xs font-bold uppercase tracking-widest mb-4" style={{ color: '#f59e0b' }}>Pro</div>
            <div className="flex items-end gap-1 mb-2">
              <span className="text-4xl font-black text-white">₹499</span>
              <span className="text-sm mb-1" style={{ color: 'rgba(255,255,255,0.4)' }}>/month</span>
            </div>
            <p className="text-sm mb-8" style={{ color: 'rgba(255,255,255,0.4)' }}>Everything you need for serious teams.</p>
            <Link
              href="/signup"
              className="block w-full text-center py-3 rounded-xl text-sm font-bold mb-8 btn-amber-shimmer"
              style={{ color: '#07071a' }}
            >
              Start free, upgrade anytime
            </Link>
            <ul className="space-y-3">
              {PAID.map((f, i) => (
                <li key={i} className="flex items-center justify-between gap-2">
                  <span className="text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>{f.label}</span>
                  <Cell value={f.value} />
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Bottom note */}
        <p className="text-center text-sm" style={{ color: 'rgba(255,255,255,0.3)' }}>
          All plans include Basha&apos;s exclusive code-mixed speech recognition — Hinglish, Tanglish, Teluglish & Kanglish.
          <br />No competitor offers this.
        </p>
      </div>
    </div>
  );
}
