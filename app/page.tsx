import Link from 'next/link';
import { Button } from '@/components/ui/Button';

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Nav */}
      <nav className="flex items-center justify-between px-6 py-4 max-w-7xl mx-auto">
        <div className="flex items-center gap-2">
          <span className="text-2xl">🗣️</span>
          <span className="font-bold text-xl text-gray-900">LinguaMeet</span>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/login">
            <Button variant="ghost">Sign in</Button>
          </Link>
          <Link href="/signup">
            <Button>Get started free</Button>
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="text-center px-6 pt-20 pb-16 max-w-4xl mx-auto">
        <div className="inline-flex items-center gap-2 bg-indigo-50 text-indigo-700 text-sm font-medium px-4 py-1.5 rounded-full mb-6">
          <span>🇮🇳</span> Built for multilingual Indian teams
        </div>

        <h1 className="text-5xl font-bold text-gray-900 leading-tight mb-6">
          Meeting notes that
          <br />
          <span className="text-indigo-600">understand every language</span>
        </h1>

        <p className="text-xl text-gray-500 max-w-2xl mx-auto mb-10 leading-relaxed">
          Speak naturally in Tamil, Hindi, Telugu, Kannada — or mix them freely.
          LinguaMeet transcribes your multilingual meetings and generates clean English notes.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link href="/signup">
            <Button size="lg" className="px-8">
              Start for free
            </Button>
          </Link>
          <Link href="/login">
            <Button size="lg" variant="secondary" className="px-8">
              Sign in
            </Button>
          </Link>
        </div>
      </section>

      {/* Code-mixed example */}
      <section className="max-w-3xl mx-auto px-6 pb-16">
        <div className="bg-gray-50 rounded-2xl p-6 border border-gray-200">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-4">
            Example transcript
          </p>
          <div className="space-y-4">
            <div className="bg-white rounded-xl p-4 border border-gray-100">
              <span className="text-xs font-mono text-gray-400">12:41</span>
              <p className="mt-2 text-sm font-medium text-gray-500">Original</p>
              <p className="text-gray-800 mt-1">
                Next week launch pannalam but marketing budget konjam increase panna vendiyirukkum.
              </p>
              <p className="mt-3 text-sm font-medium text-indigo-600">English</p>
              <p className="text-gray-700 mt-1">
                We can launch next week but we may need to increase the marketing budget.
              </p>
            </div>
            <div className="bg-white rounded-xl p-4 border border-gray-100">
              <span className="text-xs font-mono text-gray-400">14:05</span>
              <p className="mt-2 text-sm font-medium text-gray-500">Original</p>
              <p className="text-gray-800 mt-1">
                Yaar isko design karega? Timeline kya hai?
              </p>
              <p className="mt-3 text-sm font-medium text-indigo-600">English</p>
              <p className="text-gray-700 mt-1">
                Who will design this? What is the timeline?
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="max-w-6xl mx-auto px-6 py-16 grid grid-cols-1 md:grid-cols-3 gap-8">
        {[
          {
            icon: '🎙️',
            title: 'Multilingual transcription',
            desc: 'Powered by Sarvam AI. Handles Tamil, Hindi, Telugu, Kannada, and code-mixed speech natively.',
          },
          {
            icon: '📝',
            title: 'AI meeting summary',
            desc: 'Automatically extracts topics discussed, key decisions, and action items from every meeting.',
          },
          {
            icon: '🔍',
            title: 'Searchable transcript',
            desc: 'Search any word across the full transcript in both original and English versions.',
          },
        ].map((f) => (
          <div key={f.title} className="bg-white rounded-2xl p-6 border border-gray-200">
            <div className="text-3xl mb-4">{f.icon}</div>
            <h3 className="font-semibold text-gray-900 mb-2">{f.title}</h3>
            <p className="text-gray-500 text-sm leading-relaxed">{f.desc}</p>
          </div>
        ))}
      </section>

      {/* Languages */}
      <section className="bg-indigo-50 py-12 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-lg font-semibold text-gray-900 mb-6">
            Supported languages
          </h2>
          <div className="flex flex-wrap justify-center gap-3">
            {['English', 'Hindi', 'Tamil', 'Telugu', 'Kannada', 'Tanglish', 'Hinglish', 'Teluglish'].map((lang) => (
              <span
                key={lang}
                className="bg-white border border-indigo-200 text-indigo-700 text-sm font-medium px-4 py-2 rounded-full"
              >
                {lang}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="text-center py-8 text-sm text-gray-400">
        © {new Date().getFullYear()} LinguaMeet. Built for India.
      </footer>
    </div>
  );
}
