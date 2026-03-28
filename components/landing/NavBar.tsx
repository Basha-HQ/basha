'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { StardustButton } from '@/components/ui/stardust-button';

export function NavBar() {
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    let lastY = window.scrollY;
    const onScroll = () => {
      const currentY = window.scrollY;
      setHidden(currentY > lastY && currentY > 80);
      lastY = currentY;
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <div
      className="fixed top-0 left-0 right-0 z-50 w-full"
      style={{
        transform: hidden ? 'translateY(-100%)' : 'translateY(0)',
        transition: 'transform 0.3s ease',
        background: 'rgba(7,7,26,0.85)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
      }}
    >
      <nav className="flex items-center justify-between pl-6 pr-8 py-4 max-w-7xl mx-auto">
        {/* Left: Logo + Badge + Nav links */}
        <div className="flex items-center gap-6">
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
          <div className="hidden md:flex items-center gap-5">
            <Link
              href="/pricing"
              className="text-sm font-medium transition-colors hover:text-amber-400"
              style={{ color: 'rgba(255,255,255,0.55)' }}
            >
              Pricing
            </Link>
            <Link
              href="/blog"
              className="text-sm font-medium transition-colors hover:text-amber-400"
              style={{ color: 'rgba(255,255,255,0.55)' }}
            >
              Blog
            </Link>
          </div>
        </div>

        {/* Right: Sign in + CTA */}
        <div className="flex items-center gap-3">
          <Link
            href="/login"
            className="text-sm font-medium transition-colors hover:text-amber-400"
            style={{ color: 'rgba(255,255,255,0.55)' }}
          >
            Sign in
          </Link>
          <StardustButton href="/signup" size="sm">
            Get started free →
          </StardustButton>
        </div>
      </nav>
    </div>
  );
}
