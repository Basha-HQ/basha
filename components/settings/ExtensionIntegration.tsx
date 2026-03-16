'use client';

import { useState, useEffect } from 'react';

interface TokenMeta {
  exists: boolean;
  createdAt?: string;
  expiresAt?: string;
  lastUsedAt?: string | null;
}

export function ExtensionIntegration() {
  const [meta, setMeta] = useState<TokenMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [revoking, setRevoking] = useState(false);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState('');

  async function fetchMeta() {
    try {
      const res = await fetch('/api/extension/token', { method: 'POST' });
      if (res.ok) setMeta(await res.json());
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchMeta();

    // Listen for confirmation that the extension stored the token
    const handler = (event: MessageEvent) => {
      if (event.data?.type === 'BASHA_TOKEN_STORED' && event.data.success) {
        setConnected(true);
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, []);

  async function handleGenerate() {
    setGenerating(true);
    setError('');
    setConnected(false);
    try {
      const res = await fetch('/api/extension/token');
      if (!res.ok) throw new Error('Failed to generate token');
      const { token } = await res.json();
      // Relay to extension via postMessage (content-script-app.js picks this up)
      window.postMessage({ type: 'BASHA_EXT_TOKEN', token }, '*');
      // Refresh meta
      await fetchMeta();
    } catch (err) {
      setError(String(err));
    } finally {
      setGenerating(false);
    }
  }

  async function handleRevoke() {
    setRevoking(true);
    try {
      await fetch('/api/extension/token', { method: 'DELETE' });
      setMeta({ exists: false });
      setConnected(false);
    } catch {
      // ignore
    } finally {
      setRevoking(false);
    }
  }

  function formatDate(iso?: string | null) {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  return (
    <div
      className="rounded-2xl p-6 space-y-5"
      style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
            style={{ background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.25)' }}
          >
            🔌
          </div>
          <div>
            <p className="font-semibold text-white text-sm">Chrome Extension</p>
            <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.4)' }}>
              Bot-free meeting recorder — records tab audio silently
            </p>
          </div>
        </div>

        {!loading && meta?.exists && (
          <span
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold flex-shrink-0"
            style={{ background: 'rgba(16,185,129,0.12)', color: '#34d399', border: '1px solid rgba(16,185,129,0.2)' }}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            Connected
          </span>
        )}
      </div>

      {loading ? (
        <div className="h-10 flex items-center">
          <span className="text-sm text-slate-500">Loading…</span>
        </div>
      ) : meta?.exists ? (
        <div className="space-y-4">
          {/* Token metadata */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Connected', value: formatDate(meta.createdAt) },
              { label: 'Expires', value: formatDate(meta.expiresAt) },
              { label: 'Last used', value: formatDate(meta.lastUsedAt) },
            ].map(({ label, value }) => (
              <div
                key={label}
                className="rounded-lg p-3 text-center"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}
              >
                <p className="text-xs mb-1" style={{ color: 'rgba(255,255,255,0.35)' }}>{label}</p>
                <p className="text-xs font-semibold" style={{ color: 'rgba(255,255,255,0.7)' }}>{value}</p>
              </div>
            ))}
          </div>

          {connected && (
            <div
              className="px-4 py-3 rounded-lg text-xs"
              style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.15)', color: '#34d399' }}
            >
              ✓ Extension connected successfully — you can now record meetings from the extension popup.
            </div>
          )}

          <div className="flex gap-3">
            <button
              type="button"
              onClick={handleGenerate}
              disabled={generating}
              className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all disabled:opacity-50 cursor-pointer"
              style={{ background: 'rgba(99,102,241,0.15)', color: '#a5b4fc', border: '1px solid rgba(99,102,241,0.25)' }}
            >
              {generating ? 'Reconnecting…' : 'Reconnect extension'}
            </button>
            <button
              type="button"
              onClick={handleRevoke}
              disabled={revoking}
              className="py-2.5 px-4 rounded-xl text-sm font-semibold transition-all disabled:opacity-50 cursor-pointer"
              style={{ background: 'rgba(239,68,68,0.1)', color: '#f87171', border: '1px solid rgba(239,68,68,0.2)' }}
            >
              {revoking ? 'Revoking…' : 'Revoke'}
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-sm" style={{ color: 'rgba(255,255,255,0.45)' }}>
            Connect the Basha Chrome extension to your account. The extension will be able to create
            meeting recordings on your behalf — no bot joins your call.
          </p>

          <ol className="space-y-1.5 text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>
            <li>1. Install the Basha Chrome extension from the Web Store</li>
            <li>2. Click <strong style={{ color: 'rgba(255,255,255,0.6)' }}>Connect Chrome Extension</strong> below</li>
            <li>3. The extension is automatically connected in one click</li>
          </ol>

          {error && (
            <div
              className="px-4 py-3 rounded-lg text-xs"
              style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#f87171' }}
            >
              {error}
            </div>
          )}

          <button
            type="button"
            onClick={handleGenerate}
            disabled={generating}
            className="w-full py-2.5 rounded-xl text-sm font-semibold transition-all disabled:opacity-50 cursor-pointer"
            style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', color: 'white' }}
          >
            {generating ? 'Connecting…' : 'Connect Chrome Extension'}
          </button>

          <p className="text-xs text-center" style={{ color: 'rgba(255,255,255,0.2)' }}>
            Make sure the Basha extension is installed before connecting.{' '}
            <a
              href="https://chrome.google.com/webstore"
              target="_blank"
              rel="noopener noreferrer"
              className="underline"
              style={{ color: 'rgba(165,180,252,0.6)' }}
            >
              Install from Chrome Web Store
            </a>
          </p>
        </div>
      )}
    </div>
  );
}
