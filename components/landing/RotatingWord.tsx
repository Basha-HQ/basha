'use client';

import { useState, useEffect } from 'react';

const words = ['Tanglish', 'Hinglish', 'Teluglish', 'Kanglish', 'Manglish'];

const TYPE_MS  = 80;   // ms per character while typing
const ERASE_MS = 45;   // ms per character while erasing (slightly faster)
const HOLD_MS  = 1600; // pause after word is fully typed

type Phase = 'typing' | 'holding' | 'erasing';

export function RotatingWord() {
  const [wordIndex, setWordIndex] = useState(0);
  const [charIndex, setCharIndex] = useState(0);
  const [phase, setPhase]         = useState<Phase>('typing');

  const word      = words[wordIndex];
  const displayed = word.slice(0, charIndex);

  useEffect(() => {
    if (phase === 'typing') {
      if (charIndex < word.length) {
        const t = setTimeout(() => setCharIndex((c) => c + 1), TYPE_MS);
        return () => clearTimeout(t);
      }
      // Finished typing — hold
      const t = setTimeout(() => setPhase('erasing'), HOLD_MS);
      return () => clearTimeout(t);
    }

    if (phase === 'erasing') {
      if (charIndex > 0) {
        const t = setTimeout(() => setCharIndex((c) => c - 1), ERASE_MS);
        return () => clearTimeout(t);
      }
      // Finished erasing — advance to next word
      setWordIndex((i) => (i + 1) % words.length);
      setPhase('typing');
    }
  }, [phase, charIndex, word]);

  return (
    <span style={{ color: '#f59e0b', display: 'inline-block', minWidth: '9.5ch' }}>
      {displayed}
      <span className="cursor-blink" style={{ opacity: 1 }}>|</span>
    </span>
  );
}
