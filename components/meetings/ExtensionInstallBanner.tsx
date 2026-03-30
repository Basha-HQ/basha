'use client';

import { useEffect, useState } from 'react';

/**
 * Detects whether the Basha Chrome extension is installed via a ping/pong
 * postMessage exchange with the extension's content script.
 *
 * If the extension is NOT installed: renders an install CTA banner.
 * If it IS installed: renders nothing (the parent shows the ready state).
 */
export default function ExtensionInstallBanner() {
  const [detected, setDetected] = useState<boolean | null>(null); // null = checking

  useEffect(() => {
    let resolved = false;

    const handler = (event: MessageEvent) => {
      if (event.data?.type === 'BASHA_PONG' && !resolved) {
        resolved = true;
        setDetected(true);
      }
    };

    window.addEventListener('message', handler);
    window.postMessage({ type: 'BASHA_PING' }, '*');

    // If no PONG within 600ms, assume extension not installed
    const timeout = setTimeout(() => {
      if (!resolved) setDetected(false);
    }, 600);

    return () => {
      window.removeEventListener('message', handler);
      clearTimeout(timeout);
    };
  }, []);

  // Still checking
  if (detected === null) {
    return (
      <div className="flex items-center justify-center h-24 text-slate-500 text-sm">
        Checking for Basha extension…
      </div>
    );
  }

  // Extension found — parent handles the ready UI
  if (detected) return null;

  // Extension not installed — show install CTA
  return (
    <div className="rounded-xl border border-amber-500/40 bg-amber-500/5 p-5 space-y-4">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 text-2xl">🔌</div>
        <div>
          <p className="font-semibold text-white text-sm mb-1">Install the Basha extension</p>
          <p className="text-slate-400 text-xs leading-relaxed">
            Record meetings silently — no bot joins your call. Works with Google Meet,
            Zoom, and Microsoft Teams.
          </p>
        </div>
      </div>

      <ul className="space-y-2">
        {[
          { icon: '🎙', text: 'Captures tab audio directly — invisible to other participants' },
          { icon: '₹0', text: 'Free to record — no per-meeting cost' },
          { icon: '🔒', text: 'Audio never leaves your browser until you stop recording' },
        ].map(({ icon, text }) => (
          <li key={text} className="flex items-start gap-2 text-xs text-slate-400">
            <span className="shrink-0">{icon}</span>
            <span>{text}</span>
          </li>
        ))}
      </ul>

      <a
        href="https://chromewebstore.google.com/detail/basha/kljamnehjflkogflokigndnaoeagelke"
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center justify-center gap-2 w-full py-2.5 px-4 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold transition-colors cursor-pointer"
      >
        Add to Chrome — it&apos;s free
      </a>

    </div>
  );
}
