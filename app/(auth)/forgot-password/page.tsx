'use client';

import { useState } from 'react';
import Link from 'next/link';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      setSubmitted(true);
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4" style={{ backgroundColor: '#07071a' }}>
      <Link href="/" className="flex items-center gap-3 mb-8">
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center font-bold text-sm"
          style={{ background: 'linear-gradient(135deg, #f59e0b, #f97316)', color: '#07071a' }}
        >
          B
        </div>
        <span className="font-bold text-xl tracking-tight text-white">Basha</span>
      </Link>

      <div className="w-full max-w-md mx-auto">
        {submitted ? (
          <div
            className="rounded-2xl p-8 text-center"
            style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}
          >
            <div
              className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4"
              style={{ background: 'rgba(52,211,153,0.12)', border: '1px solid rgba(52,211,153,0.2)' }}
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="#34d399" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h1 className="text-xl font-bold mb-2" style={{ color: 'rgba(255,255,255,0.92)' }}>Check your email</h1>
            <p className="text-sm mb-6" style={{ color: 'rgba(255,255,255,0.45)' }}>
              If an account exists for <strong style={{ color: 'rgba(255,255,255,0.7)' }}>{email}</strong>, we&apos;ve sent a reset link. It expires in 1 hour.
            </p>
            <Link
              href="/login"
              className="text-sm font-medium"
              style={{ color: '#f59e0b' }}
            >
              ← Back to sign in
            </Link>
          </div>
        ) : (
          <div
            className="rounded-2xl p-8"
            style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}
          >
            <h1 className="text-xl font-bold mb-1" style={{ color: 'rgba(255,255,255,0.92)' }}>Forgot your password?</h1>
            <p className="text-sm mb-6" style={{ color: 'rgba(255,255,255,0.4)' }}>
              Enter your email and we&apos;ll send you a reset link.
            </p>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: 'rgba(255,255,255,0.6)' }}>
                  Email address
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                  autoComplete="email"
                  className="w-full px-4 py-3 rounded-xl text-sm outline-none transition-colors"
                  style={{
                    background: 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(255,255,255,0.12)',
                    color: 'rgba(255,255,255,0.9)',
                  }}
                />
              </div>

              {error && (
                <p className="text-sm px-3 py-2 rounded-lg" style={{ background: 'rgba(251,113,133,0.1)', color: '#fb7185' }}>
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 rounded-xl text-sm font-bold transition-all disabled:opacity-50"
                style={{ background: '#f59e0b', color: '#07071a' }}
              >
                {loading ? 'Sending…' : 'Send reset link'}
              </button>
            </form>

            <p className="text-center text-sm mt-6" style={{ color: 'rgba(255,255,255,0.35)' }}>
              <Link href="/login" className="hover:underline" style={{ color: 'rgba(255,255,255,0.5)' }}>
                ← Back to sign in
              </Link>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
