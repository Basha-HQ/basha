import Link from 'next/link';
import { DemoTranscriptTabs } from '@/components/landing/DemoTranscriptTabs';
import { RotatingWord } from '@/components/landing/RotatingWord';

/* ─── Data ─────────────────────────────────────────────────────────────── */

const languages = [
  { label: 'Hindi', mixed: false },
  { label: 'Tamil', mixed: false },
  { label: 'Telugu', mixed: false },
  { label: 'Kannada', mixed: false },
  { label: 'Malayalam', mixed: false },
  { label: 'Punjabi', mixed: false },
  { label: 'Bengali', mixed: false },
  { label: 'Marathi', mixed: false },
  { label: 'Hinglish', mixed: true },
  { label: 'Tanglish', mixed: true },
  { label: 'Teluglish', mixed: true },
  { label: 'Kanglish', mixed: true },
  { label: 'Manglish', mixed: true },
  { label: 'English', mixed: false },
];

const realities = [
  {
    n: '01',
    title: 'India has 26 states — each with its own language.',
    body: 'From Punjabi in the north to Malayalam in the south. Fully formed languages with independent grammars, scripts, and traditions.',
  },
  {
    n: '02',
    title: 'Project teams bring together speakers of different languages.',
    body: 'In Indian enterprises, a single project regularly spans four or five states — each member fluent in English but native in something else.',
  },
  {
    n: '03',
    title: 'People explain nuances better in their mother tongue.',
    body: 'The most precise thinking happens in the language you grew up in. Risks, cultural context, subtle insights — they come out in native tongue.',
  },
  {
    n: '04',
    title: 'Code-switching is natural, unconscious, and unstoppable.',
    body: 'Mixing English words into your mother tongue mid-sentence is the evolved communication style of educated, multilingual Indians.',
  },
  {
    n: '05',
    title: 'Interrupting to ask for a translation kills the conversation.',
    body: 'The moment you ask someone to repeat in English, the flow breaks, the thought is lost, and the speaker becomes self-conscious.',
  },
];

const usps = [
  {
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" />
      </svg>
    ),
    tag: 'Language USP',
    title: 'Natively understands code-mixed Indian speech',
    body: 'Not just Hindi or Tamil — Hinglish, Tanglish, Teluglish, and Kanglish. The natural, fluid way 300M+ educated urban Indians actually communicate.',
  },
  {
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
    tag: 'Output USP',
    title: 'Dual transcript — original preserved + clean English',
    body: 'Every other tool gives you one transcript. Basha gives you two: the original with full nuance intact, and a clean English version ready to share.',
  },
  {
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
    tag: 'Market USP',
    title: '67M+ Indian knowledge workers. No tool built for them.',
    body: "The world's largest English-speaking professional class that also natively speaks 22 scheduled languages. No Silicon Valley product was built for this reality.",
  },
  {
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
      </svg>
    ),
    tag: 'Cultural USP',
    title: 'Multilingualism is a strength — not a problem to fix',
    body: 'Indian professionals have spent decades being told meetings should happen in "proper English." Basha is the first product that says: your language is valid.',
  },
  {
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
    tag: 'Data Moat USP',
    title: 'Gets smarter with every Indian meeting',
    body: 'Code-mixed Indian professional speech data is extraordinarily scarce globally. Every transcript makes Basha sharper — and widens a moat no competitor can shortcut.',
  },
];

const steps = [
  {
    n: '1',
    title: 'Invite Basha',
    body: 'Paste your Google Meet or Zoom link. Basha joins as a bot — no app install, no friction.',
  },
  {
    n: '2',
    title: 'Basha listens',
    body: 'Captures every word, every language, every mid-sentence code-switch. Nothing is lost.',
  },
  {
    n: '3',
    title: 'Get dual transcript',
    body: 'Receive the original code-mixed transcript alongside a clean English version — instantly.',
  },
];

const comparison = [
  { capability: 'English meeting support', basha: true, others: true },
  { capability: 'Hindi / Tamil / Telugu support', basha: true, others: false },
  { capability: 'Code-mixed speech (Hinglish, Tanglish…)', basha: true, others: false },
  { capability: 'Dual output: original + English', basha: true, others: false },
  { capability: 'Built for Indian professional context', basha: true, others: false },
  { capability: 'Indic speech training data', basha: true, others: false },
];

const testimonials = [
  {
    quote: "Finally, a tool that doesn't make me feel like I'm communicating incorrectly. My team switches between Tamil and English every few minutes — Basha just gets it.",
    name: 'Meera Krishnan',
    role: 'Product Manager',
    company: 'Series B startup, Bengaluru',
    initials: 'MK',
  },
  {
    quote: "We were using Otter.ai but half our stand-ups are in Hinglish. The transcripts were garbage. Basha gives us something we can actually share with leadership.",
    name: 'Arjun Kapoor',
    role: 'Engineering Lead',
    company: 'Fintech, Mumbai',
    initials: 'AK',
  },
  {
    quote: "Our sales calls with regional clients are entirely in Telugu mixed with English. Basha captures every word and translates cleanly. It's changed how we document deals.",
    name: 'Lakshmi Patel',
    role: 'Sales Director',
    company: 'Enterprise SaaS, Hyderabad',
    initials: 'LP',
  },
];

/* ─── Page ──────────────────────────────────────────────────────────────── */

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white" style={{ fontFamily: 'var(--font-geist-sans, system-ui)' }}>

      {/* ── Nav ───────────────────────────────────────────────────────────── */}
      <div
        className="sticky top-0 z-50 w-full"
        style={{
          backgroundColor: 'rgba(7,7,26,0.92)',
          backdropFilter: 'blur(12px)',
          borderBottom: '1px solid rgba(255,255,255,0.07)',
        }}
      >
        <nav className="flex items-center justify-between px-6 py-4 max-w-7xl mx-auto">
          <div className="flex items-center gap-3">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm"
              style={{ background: 'linear-gradient(135deg, #f59e0b, #f97316)', color: '#07071a' }}
            >
              B
            </div>
            <span className="font-bold text-xl tracking-tight text-white">Basha</span>
            <span
              className="hidden sm:inline-flex text-xs font-semibold px-2.5 py-0.5 rounded-full"
              style={{ background: 'rgba(245,158,11,0.15)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.3)' }}
            >
              Built for India
            </span>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/pricing"
              className="text-sm font-medium transition-colors hover:text-amber-400"
              style={{ color: 'rgba(255,255,255,0.55)' }}
            >
              Pricing
            </Link>
            <Link
              href="/login"
              className="text-sm font-medium transition-colors hover:text-amber-400"
              style={{ color: 'rgba(255,255,255,0.55)' }}
            >
              Sign in
            </Link>
            <Link
              href="/signup"
              className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-sm font-bold transition-all hover:scale-105 btn-amber-shimmer"
              style={{ color: '#07071a' }}
            >
              Get started free
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </Link>
          </div>
        </nav>
      </div>

      {/* ── Hero ──────────────────────────────────────────────────────────── */}
      <section
        className="relative overflow-hidden px-6 pt-16 pb-0"
        style={{
          backgroundColor: '#07071a',
          backgroundImage: `
            radial-gradient(ellipse 90% 55% at 50% -5%, rgba(99,102,241,0.22) 0%, transparent 65%),
            radial-gradient(circle, rgba(99,102,241,0.07) 1px, transparent 1px)
          `,
          backgroundSize: '100% 100%, 36px 36px',
        }}
      >
        <div className="max-w-4xl mx-auto text-center">
          {/* Eyebrow */}
          <div className="inline-flex items-center gap-2 mb-8 px-4 py-2 rounded-full text-sm font-semibold" style={{ background: 'rgba(245,158,11,0.12)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.25)' }}>
            <span>🇮🇳</span>
            The AI Meeting Notetaker Built for India
          </div>

          {/* H1 */}
          <h1
            className="font-bold leading-[1.08] tracking-tight mb-6"
            style={{ fontSize: 'clamp(2.6rem, 7vw, 5rem)', color: '#ffffff' }}
          >
            Your meetings speak{' '}
            <RotatingWord />
            <br />
            Now your notes do too.
          </h1>

          {/* Subtext */}
          <p
            className="text-lg md:text-xl leading-relaxed mb-10 max-w-2xl mx-auto"
            style={{ color: 'rgba(255,255,255,0.55)' }}
          >
            Basha captures code-mixed Indian meetings — Hinglish, Tanglish, Teluglish — and delivers
            two transcripts: the original, preserved in full, and a clean English version ready to share.
          </p>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-16">
            <Link
              href="/signup"
              className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-xl font-bold text-base transition-all hover:scale-105 hover:brightness-110 btn-amber-shimmer"
              style={{ color: '#07071a' }}
            >
              Start for free
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </Link>
            <a
              href="#demo"
              className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-xl font-bold text-base transition-all hover:bg-white/10"
              style={{ color: 'rgba(255,255,255,0.75)', border: '1px solid rgba(255,255,255,0.15)' }}
            >
              See it in action
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </a>
          </div>

          {/* Floating preview card */}
          <div
            className="animate-float relative mx-auto max-w-2xl rounded-t-2xl overflow-hidden"
            style={{
              border: '1px solid rgba(255,255,255,0.1)',
              borderBottom: 'none',
              background: '#0d0d22',
              boxShadow: '0 -20px 80px rgba(99,102,241,0.15), 0 0 0 1px rgba(255,255,255,0.05)',
            }}
          >
            <div className="flex items-center gap-2 px-4 py-3 border-b" style={{ borderColor: 'rgba(255,255,255,0.07)', background: 'rgba(255,255,255,0.03)' }}>
              <div className="flex gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full" style={{ background: '#ff5f57' }} />
                <div className="w-2.5 h-2.5 rounded-full" style={{ background: '#febc2e' }} />
                <div className="w-2.5 h-2.5 rounded-full" style={{ background: '#28c840' }} />
              </div>
              <span className="text-xs font-mono mx-auto" style={{ color: 'rgba(255,255,255,0.2)' }}>
                basha · product-review · tanglish
              </span>
            </div>
            <div className="grid grid-cols-2 divide-x divide-white/10">
              <div className="p-4 text-left space-y-3">
                <div className="text-xs font-bold uppercase tracking-widest mb-4" style={{ color: '#f59e0b80' }}>Original</div>
                {[
                  { s: 'Priya', t: '10:14', msg: 'Next week launch pannalam but marketing budget konjam increase panna vendiyirukkum.' },
                  { s: 'Karthik', t: '10:17', msg: 'Feature ready aagidu. QA testing mattum pending.' },
                ].map((e, i) => (
                  <div key={i} className="flex gap-2">
                    <div className="w-6 h-6 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-bold" style={{ background: 'rgba(245,158,11,0.15)', color: '#f59e0b' }}>{e.s[0]}</div>
                    <div>
                      <div className="flex gap-1.5 mb-0.5">
                        <span className="text-xs font-semibold" style={{ color: 'rgba(255,255,255,0.6)' }}>{e.s}</span>
                        <span className="text-xs font-mono" style={{ color: 'rgba(255,255,255,0.2)' }}>{e.t}</span>
                      </div>
                      <p className="text-xs leading-relaxed" style={{ color: 'rgba(255,255,255,0.75)' }}>{e.msg}</p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="p-4 text-left space-y-3" style={{ background: 'rgba(99,102,241,0.04)' }}>
                <div className="text-xs font-bold uppercase tracking-widest mb-4" style={{ color: 'rgba(167,139,250,0.6)' }}>English</div>
                {[
                  { s: 'Priya', t: '10:14', msg: 'We can launch next week but the marketing budget may need to increase.' },
                  { s: 'Karthik', t: '10:17', msg: 'The feature is ready. Only QA testing remains.' },
                ].map((e, i) => (
                  <div key={i} className="flex gap-2">
                    <div className="w-6 h-6 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-bold text-indigo-200" style={{ background: 'rgba(99,102,241,0.2)', border: '1px solid rgba(99,102,241,0.3)' }}>{e.s[0]}</div>
                    <div>
                      <div className="flex gap-1.5 mb-0.5">
                        <span className="text-xs font-semibold" style={{ color: 'rgba(255,255,255,0.6)' }}>{e.s}</span>
                        <span className="text-xs font-mono" style={{ color: 'rgba(255,255,255,0.2)' }}>{e.t}</span>
                      </div>
                      <p className="text-xs leading-relaxed text-indigo-100/85">{e.msg}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Language Marquee ──────────────────────────────────────────────── */}
      <div className="overflow-hidden py-5" style={{ backgroundColor: '#07071a', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        <div className="flex animate-marquee whitespace-nowrap gap-3 w-max">
          {[...languages, ...languages].map((lang, i) => (
            <span
              key={i}
              className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-sm font-medium flex-shrink-0"
              style={
                lang.mixed
                  ? { background: 'rgba(245,158,11,0.12)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.25)' }
                  : { background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.45)', border: '1px solid rgba(255,255,255,0.1)' }
              }
            >
              {lang.mixed && <span className="text-xs">✦</span>}
              {lang.label}
            </span>
          ))}
        </div>
      </div>

      {/* ── Demo Transcripts ──────────────────────────────────────────────── */}
      <section
        id="demo"
        className="px-6 py-24"
        style={{ backgroundColor: '#0a0a1f' }}
      >
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <div
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest mb-5"
              style={{ background: 'rgba(245,158,11,0.12)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.2)' }}
            >
              ★ No competitor offers this
            </div>
            <h2
              className="font-bold leading-tight mb-4"
              style={{ fontSize: 'clamp(1.9rem, 4vw, 3rem)', color: '#ffffff' }}
            >
              See it before you believe it.
            </h2>
            <p className="text-lg max-w-xl mx-auto" style={{ color: 'rgba(255,255,255,0.45)' }}>
              Real code-mixed Indian meetings. Real Basha output. Choose your dialect.
            </p>
          </div>

          <DemoTranscriptTabs />
        </div>
      </section>

      {/* ── Indian Meeting Reality ─────────────────────────────────────────── */}
      <section className="px-6 py-24 bg-white">
        <div className="max-w-6xl mx-auto">
          <div className="max-w-2xl mb-16">
            <p className="text-sm font-bold uppercase tracking-widest text-indigo-600 mb-4">The Reality</p>
            <h2
              className="font-bold leading-tight"
              style={{ fontSize: 'clamp(1.9rem, 4vw, 3rem)', color: '#07071a' }}
            >
              Every meeting tool was built for English.
              <br />
              <span className="text-gray-400">India doesn't work that way.</span>
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {realities.map((r) => (
              <div
                key={r.n}
                className="relative p-7 rounded-2xl overflow-hidden group transition-all duration-300 hover:-translate-y-1 hover:shadow-lg"
                style={{ background: '#f8f8fc', border: '1px solid #e8e8f0' }}
              >
                <div
                  className="absolute top-4 right-5 font-black text-6xl leading-none select-none"
                  style={{ color: '#e8e8f0', fontVariantNumeric: 'tabular-nums' }}
                >
                  {r.n}
                </div>
                <h3 className="font-bold text-base leading-snug mb-3 pr-8 relative" style={{ color: '#07071a' }}>
                  {r.title}
                </h3>
                <p className="text-sm leading-relaxed relative" style={{ color: '#6b7280' }}>
                  {r.body}
                </p>
              </div>
            ))}

            {/* Promise card */}
            <div
              className="relative p-7 rounded-2xl overflow-hidden md:col-span-2 lg:col-span-1 flex flex-col justify-between"
              style={{ backgroundColor: '#07071a' }}
            >
              <div>
                <div
                  className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest px-3 py-1.5 rounded-full mb-5"
                  style={{ background: 'rgba(245,158,11,0.15)', color: '#f59e0b' }}
                >
                  The Basha Promise
                </div>
                <p className="font-semibold text-base leading-relaxed" style={{ color: 'rgba(255,255,255,0.85)' }}>
                  Basha bridges language gaps in Indian meetings without disrupting them — bringing every participant to the same table, documented in English, without asking anyone to communicate as someone they are not.
                </p>
              </div>
              <div className="mt-8 text-sm font-bold" style={{ color: '#f59e0b' }}>
                Basha — Built for India. Built for how India speaks.
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── 5 USP Layers ──────────────────────────────────────────────────── */}
      <section className="px-6 py-24" style={{ background: '#f4f4f8' }}>
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-sm font-bold uppercase tracking-widest text-indigo-600 mb-4">What makes Basha different</p>
            <h2
              className="font-bold leading-tight"
              style={{ fontSize: 'clamp(1.9rem, 4vw, 3rem)', color: '#07071a' }}
            >
              Five structural advantages
              <br />
              <span className="text-gray-400">no competitor can replicate.</span>
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {usps.map((usp, i) => (
              <div
                key={i}
                className="p-7 rounded-2xl bg-white transition-all duration-300 hover:-translate-y-1 hover:shadow-lg"
                style={{ border: '1px solid #e5e5f0' }}
              >
                <div
                  className="w-11 h-11 rounded-xl flex items-center justify-center mb-5"
                  style={{ background: '#f0f0ff', color: '#4f46e5' }}
                >
                  {usp.icon}
                </div>
                <span
                  className="text-xs font-bold uppercase tracking-widest mb-3 inline-block"
                  style={{ color: '#f59e0b' }}
                >
                  {usp.tag}
                </span>
                <h3 className="font-bold text-base leading-snug mb-3" style={{ color: '#07071a' }}>
                  {usp.title}
                </h3>
                <p className="text-sm leading-relaxed" style={{ color: '#6b7280' }}>
                  {usp.body}
                </p>
              </div>
            ))}

            {/* Extra stat card */}
            <div
              className="p-7 rounded-2xl flex flex-col justify-between"
              style={{ background: 'linear-gradient(135deg, #07071a 0%, #1e1b4b 100%)', border: '1px solid #2d2a5e' }}
            >
              <div>
                <div className="text-5xl font-black mb-3" style={{ color: '#f59e0b' }}>67M+</div>
                <p className="text-white/70 text-sm leading-relaxed">
                  Indian knowledge workers running daily video meetings in code-mixed speech — with no tool built for them.
                </p>
              </div>
              <div className="mt-6 text-xs font-semibold uppercase tracking-widest" style={{ color: 'rgba(245,158,11,0.7)' }}>
                An untapped market
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── How It Works ──────────────────────────────────────────────────── */}
      <section className="px-6 py-24 bg-white">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-sm font-bold uppercase tracking-widest text-indigo-600 mb-4">How it works</p>
            <h2
              className="font-bold leading-tight"
              style={{ fontSize: 'clamp(1.9rem, 4vw, 3rem)', color: '#07071a' }}
            >
              From meeting link to dual transcript
              <br />
              <span className="text-gray-400">in three steps.</span>
            </h2>
          </div>

          <div className="relative flex flex-col md:flex-row gap-8 md:gap-0">
            {/* Connector line */}
            <div
              className="hidden md:block absolute top-10 left-[calc(16.67%)] right-[calc(16.67%)] h-px"
              style={{ background: 'linear-gradient(90deg, #e5e5f0, #6366f1, #e5e5f0)' }}
            />

            {steps.map((step, i) => (
              <div key={i} className="flex-1 flex flex-col items-center text-center px-6 relative">
                <div
                  className="w-20 h-20 rounded-2xl flex items-center justify-center text-2xl font-black mb-6 relative z-10"
                  style={{ background: '#07071a', color: '#f59e0b', boxShadow: '0 0 0 6px #ffffff' }}
                >
                  {step.n}
                </div>
                <h3 className="font-bold text-lg mb-3" style={{ color: '#07071a' }}>{step.title}</h3>
                <p className="text-sm leading-relaxed" style={{ color: '#6b7280' }}>{step.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Comparison Table ──────────────────────────────────────────────── */}
      <section className="px-6 py-24" style={{ background: '#f4f4f8' }}>
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-14">
            <p className="text-sm font-bold uppercase tracking-widest text-indigo-600 mb-4">Competitive landscape</p>
            <h2
              className="font-bold leading-tight"
              style={{ fontSize: 'clamp(1.9rem, 4vw, 3rem)', color: '#07071a' }}
            >
              Why Indian teams switch to Basha.
            </h2>
          </div>

          <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid #e5e5f0' }}>
            {/* Header */}
            <div className="grid grid-cols-3 bg-white border-b" style={{ borderColor: '#e5e5f0' }}>
              <div className="px-6 py-4 text-sm font-semibold text-gray-500">Capability</div>
              <div className="px-6 py-4 text-center">
                <span className="text-sm font-semibold text-gray-400">Fireflies · Otter · Fathom</span>
              </div>
              <div
                className="px-6 py-4 text-center font-bold text-sm"
                style={{ background: '#07071a', color: '#f59e0b' }}
              >
                Basha
              </div>
            </div>

            {comparison.map((row, i) => (
              <div
                key={i}
                className="grid grid-cols-3 border-b last:border-b-0"
                style={{ borderColor: '#e5e5f0', background: i % 2 === 0 ? '#ffffff' : '#fafafa' }}
              >
                <div className="px-6 py-4 text-sm font-medium" style={{ color: '#374151' }}>
                  {row.capability}
                </div>
                <div className="px-6 py-4 flex items-center justify-center">
                  {row.others ? (
                    <svg className="w-5 h-5 text-emerald-500" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5" style={{ color: '#e5e5f0' }} fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                  )}
                </div>
                <div
                  className="px-6 py-4 flex items-center justify-center"
                  style={{ background: i % 2 === 0 ? '#07071a' : '#090914' }}
                >
                  <svg className="w-5 h-5" style={{ color: '#f59e0b' }} fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                </div>
              </div>
            ))}
          </div>

          <p className="text-center mt-5 text-sm" style={{ color: '#9ca3af' }}>
            Any competitor replicating Basha's core advantage must rebuild their entire speech pipeline for India. That is not a product sprint — it is a multi-year investment.
          </p>
        </div>
      </section>

      {/* ── Testimonials ──────────────────────────────────────────────────── */}
      <section className="px-6 py-24 bg-white">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <p className="text-sm font-bold uppercase tracking-widest text-indigo-600 mb-4">From Indian teams</p>
            <h2
              className="font-bold leading-tight"
              style={{ fontSize: 'clamp(1.9rem, 4vw, 3rem)', color: '#07071a' }}
            >
              What it feels like when a tool
              <br />
              <span className="text-gray-400">finally understands you.</span>
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {testimonials.map((t, i) => (
              <div
                key={i}
                className="p-7 rounded-2xl flex flex-col gap-6"
                style={{ background: '#f8f8fc', border: '1px solid #e8e8f0' }}
              >
                <div className="flex gap-1">
                  {Array.from({ length: 5 }).map((_, s) => (
                    <svg key={s} className="w-4 h-4" style={{ color: '#f59e0b' }} fill="currentColor" viewBox="0 0 20 20">
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                  ))}
                </div>
                <p className="text-sm leading-relaxed flex-1" style={{ color: '#374151' }}>
                  &ldquo;{t.quote}&rdquo;
                </p>
                <div className="flex items-center gap-3 pt-2 border-t" style={{ borderColor: '#e8e8f0' }}>
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0"
                    style={{ background: '#07071a', color: '#f59e0b' }}
                  >
                    {t.initials}
                  </div>
                  <div>
                    <div className="text-sm font-bold" style={{ color: '#07071a' }}>{t.name}</div>
                    <div className="text-xs" style={{ color: '#9ca3af' }}>{t.role} · {t.company}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA Banner ────────────────────────────────────────────────────── */}
      <section
        className="px-6 py-28 text-center"
        style={{
          backgroundColor: '#07071a',
          backgroundImage: 'radial-gradient(ellipse 70% 60% at 50% 100%, rgba(99,102,241,0.18) 0%, transparent 70%)',
        }}
      >
        <div className="max-w-3xl mx-auto">
          <h2
            className="font-black leading-tight mb-5"
            style={{ fontSize: 'clamp(2rem, 5vw, 3.5rem)', color: '#ffffff' }}
          >
            One meeting.
            <br />
            One transcript.
            <br />
            <span style={{ color: '#f59e0b' }}>Zero language gaps.</span>
          </h2>
          <p className="text-lg mb-10" style={{ color: 'rgba(255,255,255,0.45)' }}>
            Join Indian teams who speak naturally and document clearly.
          </p>
          <Link
            href="/signup"
            className="inline-flex items-center gap-2 px-10 py-5 rounded-2xl font-bold text-lg transition-all hover:scale-105 hover:brightness-110 btn-amber-shimmer"
            style={{ color: '#07071a' }}
          >
            Get started free
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
          </Link>
          <p className="mt-4 text-sm" style={{ color: 'rgba(255,255,255,0.25)' }}>
            No credit card required · Works with Google Meet & Zoom
          </p>
        </div>
      </section>

      {/* ── Footer ────────────────────────────────────────────────────────── */}
      <footer
        className="px-6 py-10 border-t"
        style={{ backgroundColor: '#07071a', borderColor: 'rgba(255,255,255,0.06)' }}
      >
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center font-bold text-sm"
              style={{ background: 'linear-gradient(135deg, #f59e0b, #f97316)', color: '#07071a' }}
            >
              B
            </div>
            <span className="font-bold text-white">Basha</span>
            <span className="text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>Built for India. Built for how India speaks.</span>
          </div>
          <div className="flex items-center gap-6 text-sm" style={{ color: 'rgba(255,255,255,0.35)' }}>
            <a href="#" className="hover:text-white transition-colors">Features</a>
            <a href="#" className="hover:text-white transition-colors">Pricing</a>
            <a href="#" className="hover:text-white transition-colors">Blog</a>
            <Link href="/login" className="hover:text-white transition-colors">Sign in</Link>
            <Link href="/signup" className="hover:text-white transition-colors">Get started</Link>
          </div>
          <p className="text-xs" style={{ color: 'rgba(255,255,255,0.2)' }}>
            © {new Date().getFullYear()} Basha. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
