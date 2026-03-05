import { LoginForm } from '@/components/auth/LoginForm';
import Link from 'next/link';

export const metadata = { title: 'Sign in — LinguaMeet' };

export default function LoginPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 bg-gray-50">
      <Link href="/" className="flex items-center gap-2 mb-8">
        <span className="text-2xl">🗣️</span>
        <span className="font-bold text-xl text-gray-900">LinguaMeet</span>
      </Link>
      <LoginForm />
    </div>
  );
}
