import { DemoTranscriptTabs } from '@/components/landing/DemoTranscriptTabs';
import { RotatingWord } from '@/components/landing/RotatingWord';
import { FadeIn } from '@/components/ui/FadeIn';
import { StardustButton } from '@/components/ui/stardust-button';
import { NavBar } from '@/components/landing/NavBar';
import Link from 'next/link';

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
    body: 'In Indian companies, a single project regularly spans four or five states — each member skilled in their work but native in different languages.',
  },
  {
    n: '03',
    title: 'People explain nuances better in their mother tongue.',
    body: 'The risk a developer flags in Telugu is the same risk that gets lost when they translate it to English. Precision belongs to the mother tongue.',
  },
  {
    n: '04',
    title: 'Mixing languages mid-sentence is not a habit to fix.',
    body: 'It is how educated, multilingual Indians naturally think and talk. (Linguists call it code-switching. Indians just call it Tuesday.)',
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
    title: 'Gets more accurate the more Indian teams use it',
    body: 'Indian language mixing in professional meetings is rarely recorded anywhere in the world. Every meeting that runs through Basha teaches it something other tools will never learn. The longer Indian teams use it, the better it gets — and no competitor can skip that process.',
  },
];

const steps = [
  {
    n: '1',
    title: 'Install Basha for Chrome',
    body: 'One click from the Chrome Web Store. Works with Google Meet, Zoom, and Teams. No account needed yet.',
  },
  {
    n: '2',
    title: 'Record your meeting tab',
    body: 'Click the Basha icon when your meeting starts. No bot account enters the room. No notification appears. Nobody knows you are recording notes.',
  },
  {
    n: '3',
    title: 'Get dual transcripts',
    body: 'Get two transcripts. The original — every language shift saved exactly as spoken. And a clean English version, ready to drop into Notion, Jira, or an email. Both ready within minutes.',
  },
];

const comparison = [
  { capability: 'English meeting support', basha: true, others: true },
  { capability: 'Records without a bot joining the call', basha: true, others: false },
  { capability: 'Hindi / Tamil / Telugu support', basha: true, others: false },
  { capability: 'Code-mixed speech (Hinglish, Tanglish…)', basha: true, others: false },
  { capability: 'Dual output: original + English', basha: true, others: false },
  { capability: 'Built for Indian professional context', basha: true, others: false },
  { capability: 'Indian language training data', basha: true, others: false },
];


/* ─── Page ──────────────────────────────────────────────────────────────── */

export default function LandingPage() {
  return (
    <div className="min-h-screen" style={{ backgroundColor: '#07071a', fontFamily: 'var(--font-geist-sans, system-ui)' }}>

      {/* ── Nav ───────────────────────────────────────────────────────────── */}
      <NavBar />

      {/* ── Hero ──────────────────────────────────────────────────────────── */}
      <section
        className="relative overflow-hidden px-6 pt-24 pb-0"
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
            Basha · बाषा · மொழி · భాష · <em>language.</em>
          </div>

          {/* H1 */}
          <h1
            className="font-bold leading-[1.08] tracking-tight mb-6"
            style={{ fontSize: 'clamp(2.6rem, 7vw, 5rem)', color: '#ffffff', fontFamily: 'var(--font-display)' }}
          >
            Speak{' '}
            <RotatingWord />.
            <br />
            Get clean English notes.
          </h1>

          {/* Subtext */}
          <p
            className="text-lg md:text-xl leading-relaxed mb-10 max-w-2xl mx-auto"
            style={{ color: 'rgba(255,255,255,0.55)' }}
          >
            Silent Chrome recording. No bots. Speak naturally in Hinglish, Tanglish, or Tamil —
            get an AI transcript in the original language plus a{' '}
            <span style={{ color: '#a5b4fc' }}>clean English version</span> to share.
          </p>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-16">
            <StardustButton href="/signup" size="md">
              <svg className="w-5 h-5 mr-1.5 flex-shrink-0" viewBox="0 0 48 48" aria-hidden="true">
                <defs>
                  <linearGradient id="chrome-red" x1="3.2173" y1="15" x2="44.7812" y2="15" gradientUnits="userSpaceOnUse">
                    <stop offset="0" stopColor="#d93025"/><stop offset="1" stopColor="#ea4335"/>
                  </linearGradient>
                  <linearGradient id="chrome-yellow" x1="20.7219" y1="47.6791" x2="41.5039" y2="11.6837" gradientUnits="userSpaceOnUse">
                    <stop offset="0" stopColor="#fcc934"/><stop offset="1" stopColor="#fbbc04"/>
                  </linearGradient>
                  <linearGradient id="chrome-green" x1="26.5981" y1="46.5015" x2="5.8161" y2="10.506" gradientUnits="userSpaceOnUse">
                    <stop offset="0" stopColor="#1e8e3e"/><stop offset="1" stopColor="#34a853"/>
                  </linearGradient>
                </defs>
                <circle cx="24" cy="23.9947" r="12" fill="#fff"/>
                <path d="M24,12H44.7812a23.9939,23.9939,0,0,0-41.5639.0029L13.6079,30l.0093-.0024A11.9852,11.9852,0,0,1,24,12Z" fill="url(#chrome-red)"/>
                <circle cx="24" cy="24" r="9.5" fill="#1a73e8"/>
                <path d="M34.3913,30.0029,24.0007,48A23.994,23.994,0,0,0,44.78,12.0031H23.9989l-.0025.0093A11.985,11.985,0,0,1,34.3913,30.0029Z" fill="url(#chrome-yellow)"/>
                <path d="M13.6086,30.0031,3.218,12.006A23.994,23.994,0,0,0,24.0025,48L34.3931,30.0029l-.0067-.0068a11.9852,11.9852,0,0,1-20.7778.007Z" fill="url(#chrome-green)"/>
              </svg>
              Add to Chrome · Free
            </StardustButton>
            <StardustButton href="#demo" size="md" variant="outline">
              See a live Tanglish transcript ↓
            </StardustButton>
          </div>

          {/* Floating preview card */}
          <div
            className="animate-float relative mx-auto max-w-2xl rounded-t-2xl overflow-hidden"
            style={{
              border: '1px solid rgba(255,255,255,0.1)',
              borderBottom: 'none',
              background: '#0d0d22',
              boxShadow: '0 -20px 80px rgba(99,102,241,0.15), 0 0 0 1px rgba(255,255,255,0.05)',
              WebkitMaskImage: 'linear-gradient(to bottom, black 55%, transparent 100%)',
              maskImage: 'linear-gradient(to bottom, black 55%, transparent 100%)',
            }}
          >
            <div className="flex items-center gap-2 px-4 py-3 border-b" style={{ borderColor: 'rgba(255,255,255,0.07)', background: 'rgba(255,255,255,0.03)' }}>
              <div className="flex gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full" style={{ background: '#ff5f57' }} />
                <div className="w-2.5 h-2.5 rounded-full" style={{ background: '#febc2e' }} />
                <div className="w-2.5 h-2.5 rounded-full" style={{ background: '#28c840' }} />
              </div>
              <span className="text-xs font-mono mx-auto" style={{ color: 'rgba(255,255,255,0.2)' }}>
                basha · product-review · tanglish (Tamil + English)
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 divide-x divide-white/10">
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
      <div className="overflow-hidden py-5" style={{ backgroundColor: '#07071a' }}>
        <div className="flex animate-marquee whitespace-nowrap gap-3 w-max">
          {[...languages, ...languages].map((lang, i) => (
            <span
              key={i}
              className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-sm font-medium flex-shrink-0"
              style={
                lang.mixed
                  ? { background: 'rgba(245,158,11,0.12)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.25)' }
                  : { background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.65)', border: '1px solid rgba(255,255,255,0.1)' }
              }
            >
              {lang.mixed && <span className="text-xs">✦</span>}
              {lang.label}
            </span>
          ))}
        </div>
      </div>

      {/* ── 20/80 Insight ─────────────────────────────────────────────────── */}
      <section className="px-6 py-24" style={{ backgroundColor: '#0d0d24' }}>
        <div className="max-w-6xl mx-auto">
          <FadeIn>
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-12 lg:gap-16 items-start">
              {/* Left — stat stack */}
              <div className="lg:col-span-3">
                <div
                  className="font-bold mb-4 leading-none"
                  style={{ fontSize: 'clamp(5rem, 12vw, 9rem)', color: '#f59e0b', fontFamily: 'var(--font-display)' }}
                >
                  80%
                </div>
                <p className="text-xl font-semibold mb-6" style={{ color: '#ffffff' }}>
                  of India's technical teams are from regional-medium schools.
                </p>
                <p className="text-base leading-relaxed mb-3" style={{ color: 'rgba(255,255,255,0.55)' }}>
                  They are equally capable.
                </p>
                <p className="text-base leading-relaxed mb-3" style={{ color: 'rgba(255,255,255,0.55)' }}>
                  They think in their mother tongue.
                </p>
                <p className="text-base leading-relaxed font-semibold" style={{ color: 'rgba(255,255,255,0.8)' }}>
                  Every English-only meeting tool has been silencing them.
                </p>
              </div>
              {/* Right — narrative */}
              <div className="lg:col-span-2 space-y-5 lg:pt-4">
                <p className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.65)' }}>
                  Every major meeting notes tool — Otter, Fireflies, Fathom, Zoom Notes — was built by
                  American companies for meetings where everyone speaks one language fluently.
                </p>
                <p className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.65)' }}>
                  In India, client meetings default to English. The 20% who are fully fluent run the room.
                  The 80% — equally skilled, natively multilingual — participate in a language that is
                  not their strongest.
                </p>
                <p className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.65)' }}>
                  Their ideas come out smaller than they are. Their risks get softened in translation.
                  Their notes are pale shadows of what was actually said.
                </p>
                <p className="text-sm leading-relaxed font-semibold" style={{ color: 'rgba(255,255,255,0.85)' }}>
                  Basha was built for the 80%.
                </p>
              </div>
            </div>
            {/* Closing statement */}
            <div className="mt-14 pt-8 border-t" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
              <p className="text-base max-w-3xl" style={{ color: 'rgba(255,255,255,0.5)' }}>
                Both groups already use English tools for tasks — Jira, Figma, email, Notion.
                Regional language is for thinking, arguing, explaining, and deciding in real time.
                That is where the real work happens. That is what Basha captures.
              </p>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* ── Demo Transcripts ──────────────────────────────────────────────── */}
      <section
        id="demo"
        className="px-6 py-24"
        style={{ backgroundColor: '#0a0a1f' }}
      >
        <div className="max-w-5xl mx-auto">
          <FadeIn>
            <div className="text-center mb-14">
              <div
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest mb-5"
                style={{ background: 'rgba(245,158,11,0.12)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.2)' }}
              >
                ★ The proof
              </div>
              <h2
                className="font-bold leading-tight mb-4"
                style={{ fontSize: 'clamp(1.9rem, 4vw, 3rem)', color: '#ffffff', fontFamily: 'var(--font-display)' }}
              >
                This is what that 80% sounds like.
              </h2>
              <p className="text-lg max-w-xl mx-auto" style={{ color: 'rgba(255,255,255,0.45)' }}>
                Real Tanglish, Hinglish, Teluglish, and Kanglish meetings. Every language shift saved. Every word translated into clean English.
              </p>
            </div>
          </FadeIn>

          <FadeIn delay={150}>
            <DemoTranscriptTabs />
          </FadeIn>
        </div>
      </section>

      {/* ── Indian Meeting Reality ─────────────────────────────────────────── */}
      <section className="px-6 py-24" style={{ backgroundColor: '#0d0d24' }}>
        <div className="max-w-6xl mx-auto">
          <FadeIn>
            <div className="max-w-2xl mb-16">
              <p className="text-sm font-bold uppercase tracking-widest text-indigo-400 mb-4">Why this exists</p>
              <h2
                className="font-bold leading-tight"
                style={{ fontSize: 'clamp(1.9rem, 4vw, 3rem)', color: '#ffffff', fontFamily: 'var(--font-display)' }}
              >
                Every meeting tool was built for English.
                <br />
                <span style={{ color: 'rgba(255,255,255,0.35)' }}>India never did.</span>
              </h2>
            </div>
          </FadeIn>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {realities.map((r, i) => (
              <FadeIn key={r.n} delay={i * 80}>
                <div
                  className="relative p-7 rounded-2xl overflow-hidden group transition-all duration-300 hover:-translate-y-1 h-full"
                  style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
                >
                  <div
                    className="absolute top-4 right-5 font-black text-6xl leading-none select-none"
                    style={{ color: 'rgba(245,158,11,0.13)', fontVariantNumeric: 'tabular-nums' }}
                  >
                    {r.n}
                  </div>
                  <h3 className="font-bold text-base leading-snug mb-3 pr-8 relative" style={{ color: '#ffffff' }}>
                    {r.title}
                  </h3>
                  <p className="text-sm leading-relaxed relative" style={{ color: 'rgba(255,255,255,0.5)' }}>
                    {r.body}
                  </p>
                </div>
              </FadeIn>
            ))}

            {/* Promise card */}
            <FadeIn delay={realities.length * 80}>
              <div
                className="relative p-7 rounded-2xl overflow-hidden md:col-span-2 lg:col-span-1 flex flex-col justify-between h-full"
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
                    Basha doesn&apos;t ask you to change how you speak. It changes what the transcript can hold. Every language shift captured. Every nuance saved. Clean English output ready for whoever needs it.
                  </p>
                  <p className="text-sm mt-4" style={{ color: 'rgba(255,255,255,0.4)' }}>
                    The word &ldquo;Basha&rdquo; means language — in Tamil, Malayalam, and across the Dravidian south. We named it that on purpose.
                  </p>
                </div>
                <div className="mt-8 text-sm font-bold" style={{ color: '#f59e0b' }}>
                  Basha — Built for India. Built for how India speaks.
                </div>
              </div>
            </FadeIn>
          </div>
        </div>
      </section>

      {/* ── 5 USP Layers ──────────────────────────────────────────────────── */}
      <section className="px-6 py-24" style={{ backgroundColor: '#0b0b1f' }}>
        <div className="max-w-6xl mx-auto">
          <FadeIn>
            <div className="text-center mb-16">
              <p className="text-sm font-bold uppercase tracking-widest text-indigo-400 mb-4">What makes Basha different</p>
              <h2
                className="font-bold leading-tight"
                style={{ fontSize: 'clamp(1.9rem, 4vw, 3rem)', color: '#ffffff', fontFamily: 'var(--font-display)' }}
              >
                Five things Basha does
                <br />
                <span style={{ color: 'rgba(255,255,255,0.35)' }}>that no other tool can.</span>
              </h2>
            </div>
          </FadeIn>

          <FadeIn>
            <div className="text-center mb-12 py-8 border-y" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
              <div
                className="font-bold mb-2"
                style={{ fontSize: 'clamp(4rem, 10vw, 6rem)', color: '#f59e0b', fontFamily: 'var(--font-display)', lineHeight: 1 }}
              >
                67M+
              </div>
              <p className="text-lg" style={{ color: 'rgba(255,255,255,0.55)' }}>
                Indian professionals. Zero tools built for them. Until now.
              </p>
            </div>
          </FadeIn>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {usps.map((usp, i) => (
              <FadeIn key={i} delay={i * 80}>
                <div
                  className="p-7 rounded-2xl transition-all duration-300 hover:-translate-y-1 h-full"
                  style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
                >
                  <div
                    className="w-11 h-11 rounded-xl flex items-center justify-center mb-5"
                    style={{ background: 'rgba(99,102,241,0.15)', color: '#818cf8' }}
                  >
                    {usp.icon}
                  </div>
                  <span
                    className="text-xs font-bold uppercase tracking-widest mb-3 inline-block"
                    style={{ color: '#f59e0b' }}
                  >
                    {usp.tag}
                  </span>
                  <h3 className="font-bold text-base leading-snug mb-3" style={{ color: '#ffffff' }}>
                    {usp.title}
                  </h3>
                  <p className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.5)' }}>
                    {usp.body}
                  </p>
                </div>
              </FadeIn>
            ))}

          </div>
        </div>
      </section>

      {/* ── How It Works ──────────────────────────────────────────────────── */}
      <section className="px-6 py-24" style={{ backgroundColor: '#0d0d24' }}>
        <div className="max-w-4xl mx-auto">
          <FadeIn>
            <div className="text-center mb-16">
              <p className="text-sm font-bold uppercase tracking-widest text-indigo-400 mb-4">How it works</p>
              <h2
                className="font-bold leading-tight"
                style={{ fontSize: 'clamp(1.9rem, 4vw, 3rem)', color: '#ffffff', fontFamily: 'var(--font-display)' }}
              >
                From install to dual transcript
                <br />
                <span style={{ color: 'rgba(255,255,255,0.35)' }}>in three steps. No bots.</span>
              </h2>
            </div>
          </FadeIn>

          <div className="relative flex flex-col md:flex-row gap-8 md:gap-0">
            {/* Connector line */}
            <div
              className="hidden md:block absolute top-10 left-[calc(16.67%)] right-[calc(16.67%)] h-px"
              style={{ background: 'linear-gradient(90deg, #0d0d24, #6366f1, #0d0d24)' }}
            />

            {steps.map((step, i) => (
              <FadeIn key={i} delay={i * 120} className="flex-1">
                <div className="flex flex-col items-center text-center px-6 relative">
                  <div
                    className="w-20 h-20 rounded-2xl flex items-center justify-center text-2xl font-black mb-6 relative z-10"
                    style={{ background: 'rgba(245,158,11,0.12)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.25)', boxShadow: '0 0 0 6px #0d0d24' }}
                  >
                    {step.n}
                  </div>
                  <h3 className="font-bold text-lg mb-3" style={{ color: '#ffffff' }}>{step.title}</h3>
                  <p className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.5)' }}>{step.body}</p>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* ── Comparison Table ──────────────────────────────────────────────── */}
      <section className="px-6 py-24" style={{ backgroundColor: '#0b0b1f' }}>
        <div className="max-w-4xl mx-auto">
          <FadeIn>
            <div className="text-center mb-14">
              <p className="text-sm font-bold uppercase tracking-widest text-indigo-400 mb-4">Competitive landscape</p>
              <h2
                className="font-bold leading-tight"
                style={{ fontSize: 'clamp(1.9rem, 4vw, 3rem)', color: '#ffffff', fontFamily: 'var(--font-display)' }}
              >
                What Basha does that other tools cannot.
              </h2>
            </div>
          </FadeIn>

          <FadeIn delay={100}>
          <div role="table" aria-label="Capability comparison between Basha and competitors" className="rounded-2xl overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.08)' }}>
            {/* Header */}
            <div role="rowgroup">
              <div role="row" className="grid grid-cols-3 border-b" style={{ background: '#0d0d28', borderColor: 'rgba(255,255,255,0.06)' }}>
                <div role="columnheader" className="px-6 py-4 text-sm font-semibold" style={{ color: 'rgba(255,255,255,0.65)' }}>Capability</div>
                <div role="columnheader" className="px-6 py-4 text-center">
                  <span className="text-sm font-semibold" style={{ color: 'rgba(255,255,255,0.5)' }}>Fireflies · Otter · Fathom</span>
                </div>
                <div
                  role="columnheader"
                  className="px-6 py-4 text-center font-bold text-sm"
                  style={{ background: '#07071a', color: '#f59e0b' }}
                >
                  Basha
                </div>
              </div>
            </div>

            <div role="rowgroup">
            {comparison.map((row, i) => (
              <div
                key={i}
                role="row"
                className="grid grid-cols-3 border-b last:border-b-0"
                style={{ borderColor: 'rgba(255,255,255,0.06)', background: i % 2 === 0 ? '#0d0d28' : '#0f0f2e' }}
              >
                <div role="rowheader" className="px-6 py-4 text-sm font-medium" style={{ color: 'rgba(255,255,255,0.75)' }}>
                  {row.capability}
                </div>
                <div role="cell" className="px-6 py-4 flex items-center justify-center">
                  {row.others ? (
                    <svg aria-label="Yes" className="w-5 h-5 text-emerald-400" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  ) : (
                    <svg aria-label="No" className="w-5 h-5" style={{ color: 'rgba(255,255,255,0.25)' }} fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                  )}
                </div>
                <div
                  role="cell"
                  className="px-6 py-4 flex items-center justify-center"
                  style={{ background: i % 2 === 0 ? '#07071a' : '#090914' }}
                >
                  <svg aria-label="Yes" className="w-5 h-5" style={{ color: '#f59e0b' }} fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                </div>
              </div>
            ))}
            </div>
          </div>

          </FadeIn>

          <div className="mt-5 px-6 py-4 rounded-xl text-sm font-medium" style={{ background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.15)', color: 'rgba(255,255,255,0.7)' }}>
            Could another tool just add Indian language support tomorrow? No — they would need to rebuild their core speech engine from scratch. That takes years, not months. Basha has been building this from day one.
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
        <FadeIn>
          <div className="max-w-3xl mx-auto">
            <h2
              className="font-bold leading-tight mb-5"
              style={{ fontSize: 'clamp(2rem, 5vw, 3.5rem)', color: '#ffffff', fontFamily: 'var(--font-display)' }}
            >
              One meeting.
              <br />
              One transcript.
              <br />
              <span style={{ color: '#f59e0b' }}>Zero language gaps.</span>
            </h2>
            <p className="text-lg mb-6" style={{ color: 'rgba(255,255,255,0.45)' }}>
              Join PMs, founders, and engineers across India who stopped losing their best ideas to a notes tool that did not understand them.
            </p>
            <p className="text-base font-semibold mb-10" style={{ color: 'rgba(255,255,255,0.7)' }}>
              Basha means language. We built it for yours.
            </p>
            <StardustButton href="/signup" size="lg">
              Add to Chrome — it is free →
            </StardustButton>
            <p className="mt-4 text-sm" style={{ color: 'rgba(255,255,255,0.25)' }}>
              No credit card required · No bot joining your meeting · Chrome extension
            </p>
          </div>
        </FadeIn>
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
            <span className="text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>Basha (बाषा · மொழி · భాష) — language. Built for India. Built for how India speaks.</span>
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
