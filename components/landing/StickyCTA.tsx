'use client';

import { useState, useEffect } from 'react';
import { StardustButton } from '@/components/ui/stardust-button';

export function StickyCTA() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 400);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <div
      className="fixed top-5 right-6 z-40"
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(-12px)',
        transition: 'opacity 0.3s ease, transform 0.3s ease',
        pointerEvents: visible ? 'auto' : 'none',
      }}
    >
      <StardustButton href="/signup" size="sm">
        Get started free →
      </StardustButton>
    </div>
  );
}
