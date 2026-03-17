'use client';

import { useState } from 'react';

interface Props {
  meetingId: string;
  initialShareToken: string | null;
}

export function SharePanel({ meetingId, initialShareToken }: Props) {
  const [shareToken, setShareToken] = useState<string | null>(initialShareToken);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const shareUrl = shareToken
    ? `${typeof window !== 'undefined' ? window.location.origin : ''}/share/${shareToken}`
    : null;

  async function handleGenerate() {
    setLoading(true);
    const res = await fetch(`/api/meetings/${meetingId}/share`, { method: 'POST' });
    const data = await res.json();
    setShareToken(data.shareToken);
    setLoading(false);
  }

  async function handleRevoke() {
    setLoading(true);
    await fetch(`/api/meetings/${meetingId}/share`, { method: 'DELETE' });
    setShareToken(null);
    setLoading(false);
  }

  async function handleCopy() {
    if (!shareUrl) return;
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div
      className="rounded-2xl px-6 py-4"
      style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}
    >
      <div className="flex items-center gap-2.5 mb-3">
        <div
          className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
          style={{ background: 'rgba(99,102,241,0.12)', color: '#6366f1' }}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
            <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/>
            <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
          </svg>
        </div>
        <div>
          <h3 className="font-semibold text-sm" style={{ color: 'rgba(255,255,255,0.9)' }}>
            Share transcript
          </h3>
          <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.35)' }}>
            Anyone with the link can view the summary and transcript — no login needed
          </p>
        </div>
      </div>

      {shareToken ? (
        <div className="flex items-center gap-2">
          <div
            className="flex-1 min-w-0 px-3 py-2 rounded-lg text-xs font-mono truncate"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.55)' }}
          >
            {shareUrl}
          </div>
          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold shrink-0 transition-all cursor-pointer"
            style={{
              background: copied ? 'rgba(52,211,153,0.12)' : 'rgba(99,102,241,0.12)',
              border: copied ? '1px solid rgba(52,211,153,0.3)' : '1px solid rgba(99,102,241,0.25)',
              color: copied ? '#34d399' : '#a5b4fc',
            }}
          >
            {copied ? (
              <>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
                Copied!
              </>
            ) : (
              <>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                </svg>
                Copy link
              </>
            )}
          </button>
          <button
            onClick={handleRevoke}
            disabled={loading}
            className="px-3 py-2 rounded-lg text-xs font-semibold shrink-0 transition-opacity disabled:opacity-50 cursor-pointer"
            style={{
              background: 'rgba(251,113,133,0.08)',
              border: '1px solid rgba(251,113,133,0.2)',
              color: '#fb7185',
            }}
            title="Revoke link — anyone with the link will no longer be able to view"
          >
            Revoke
          </button>
        </div>
      ) : (
        <button
          onClick={handleGenerate}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all disabled:opacity-50 cursor-pointer"
          style={{
            background: 'rgba(99,102,241,0.12)',
            border: '1px solid rgba(99,102,241,0.25)',
            color: '#a5b4fc',
          }}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
            <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/>
            <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
          </svg>
          {loading ? 'Generating…' : 'Generate share link'}
        </button>
      )}
    </div>
  );
}
