import { SignupForm } from '@/components/auth/SignupForm';
import Link from 'next/link';

export const metadata = { title: 'Create account — LinguaMeet' };

export default function SignupPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 bg-gray-50">
      <Link href="/" className="flex items-center gap-2 mb-8">
        <span className="text-2xl">🗣️</span>
        <span className="font-bold text-xl text-gray-900">LinguaMeet</span>
      </Link>
      <SignupForm />
    </div>
  );
}
