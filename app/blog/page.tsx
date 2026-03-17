import Link from 'next/link';

export default function BlogPage() {
  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ backgroundColor: '#07071a', fontFamily: 'var(--font-geist-sans, system-ui)' }}
    >
      {/* Nav */}
      <div
        className="sticky top-0 z-50 w-full"
        style={{ backgroundColor: 'rgba(7,7,26,0.92)', backdropFilter: 'blur(12px)' }}
      >
        <nav className="flex items-center justify-between px-6 py-4 max-w-7xl mx-auto">
          <Link href="/" className="flex items-center gap-3">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm"
              style={{ background: 'linear-gradient(135deg, #f59e0b, #f97316)', color: '#07071a' }}
            >
              B
            </div>
            <span className="font-bold text-xl tracking-tight text-white">Basha</span>
          </Link>
          <div className="flex items-center gap-5">
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
          </div>
        </nav>
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-24 text-center">
        <div
          className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold mb-8"
          style={{ background: 'rgba(245,158,11,0.12)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.25)' }}
        >
          <span>✦</span>
          Coming Soon
        </div>
        <h1
          className="font-bold leading-tight mb-5"
          style={{ fontSize: 'clamp(2rem, 5vw, 3.5rem)', color: '#ffffff' }}
        >
          The Basha Blog
        </h1>
        <p
          className="text-lg max-w-xl mx-auto mb-10"
          style={{ color: 'rgba(255,255,255,0.45)' }}
        >
          Stories about Indian language, code-mixed speech, and building AI for how India actually communicates.
          <br />
          Posts coming soon.
        </p>
        <Link
          href="/"
          className="text-sm font-semibold transition-colors hover:text-amber-400"
          style={{ color: 'rgba(255,255,255,0.4)' }}
        >
          ← Back to home
        </Link>
      </div>
    </div>
  );
}
