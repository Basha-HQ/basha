'use client';

import { useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get('token') ?? '';

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!token) {
    return (
      <div className="text-center">
        <p className="text-sm mb-4" style={{ color: 'rgba(255,255,255,0.45)' }}>
          This reset link is invalid or has expired.
        </p>
        <Link href="/forgot-password" className="text-sm font-medium" style={{ color: '#f59e0b' }}>
          Request a new reset link →
        </Link>
      </div>
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (password !== confirm) {
      setError('Passwords do not match');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Something went wrong');
        return;
      }
      router.push('/login?reset=1');
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium mb-1.5" style={{ color: 'rgba(255,255,255,0.6)' }}>
          New password
        </label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="At least 8 characters"
          required
          minLength={8}
          autoComplete="new-password"
          className="w-full px-4 py-3 rounded-xl text-sm outline-none"
          style={{
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.12)',
            color: 'rgba(255,255,255,0.9)',
          }}
        />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1.5" style={{ color: 'rgba(255,255,255,0.6)' }}>
          Confirm new password
        </label>
        <input
          type="password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          placeholder="••••••••"
          required
          autoComplete="new-password"
          className="w-full px-4 py-3 rounded-xl text-sm outline-none"
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
        {loading ? 'Saving…' : 'Set new password'}
      </button>
    </form>
  );
}

export default function ResetPasswordPage() {
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
        <div
          className="rounded-2xl p-8"
          style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}
        >
          <h1 className="text-xl font-bold mb-1" style={{ color: 'rgba(255,255,255,0.92)' }}>Set a new password</h1>
          <p className="text-sm mb-6" style={{ color: 'rgba(255,255,255,0.4)' }}>
            Choose a strong password for your account.
          </p>

          <Suspense fallback={<p className="text-sm" style={{ color: 'rgba(255,255,255,0.4)' }}>Loading…</p>}>
            <ResetPasswordForm />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
