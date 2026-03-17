import { Suspense } from 'react';
import { LoginForm } from '@/components/auth/LoginForm';
import Link from 'next/link';

export const metadata = { title: 'Sign in — Basha' };

export default function LoginPage() {
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
        <span
          className="text-xs font-semibold px-2.5 py-0.5 rounded-full"
          style={{ background: 'rgba(245,158,11,0.15)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.3)' }}
        >
          Built for India
        </span>
      </Link>
      <Suspense fallback={null}>
        <LoginForm />
      </Suspense>
    </div>
  );
}
