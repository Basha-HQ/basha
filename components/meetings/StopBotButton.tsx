'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface Props {
  botId: string;
}

export function StopBotButton({ botId }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleStop() {
    if (!confirm('Stop the bot and discard this recording? This cannot be undone.')) return;
    setLoading(true);
    try {
      await fetch(`/api/bots/${botId}`, { method: 'DELETE' });
      router.refresh();
    } catch {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={handleStop}
      disabled={loading}
      className="mt-4 px-4 py-2 rounded-xl text-sm font-semibold transition-opacity disabled:opacity-50"
      style={{
        background: 'rgba(251,113,133,0.1)',
        border: '1px solid rgba(251,113,133,0.25)',
        color: '#fb7185',
      }}
    >
      {loading ? 'Stopping…' : 'Stop & Discard'}
    </button>
  );
}
