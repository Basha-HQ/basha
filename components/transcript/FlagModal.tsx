'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/Button';

interface TranscriptRow {
  id: string;
  original_text: string;
  english_text: string | null;
}

interface Props {
  segment: TranscriptRow;
  onClose: () => void;
}

export function FlagModal({ segment, onClose }: Props) {
  const [correction, setCorrection] = useState('');
  const [comment, setComment] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    const res = await fetch(`/api/transcripts/${segment.id}/flag`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        flaggedText: segment.original_text,
        suggestedCorrection: correction,
        comment,
      }),
    });

    setLoading(false);

    // 409 means already flagged — treat as success from UX perspective
    if (res.ok || res.status === 409) {
      setDone(true);
      setTimeout(onClose, 1500);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
        <div className="px-6 py-5 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">Flag transcript issue</h2>
          <p className="text-sm text-gray-400 mt-1">
            Help us improve — tell us what the correct transcription should be
          </p>
        </div>

        <div className="px-6 py-4">
          <div className="bg-gray-50 rounded-lg p-3 mb-4 text-sm text-gray-700">
            <p className="text-xs text-gray-400 mb-1">Flagging segment</p>
            {segment.original_text}
          </div>

          {done ? (
            <div className="text-center py-4">
              <p className="text-2xl mb-2">✅</p>
              <p className="text-sm text-green-600 font-medium">
                Thanks for the feedback!
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-700">
                  What should it say?
                </label>
                <input
                  type="text"
                  value={correction}
                  onChange={(e) => setCorrection(e.target.value)}
                  placeholder="e.g. pannalam"
                  className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700">
                  Additional context{' '}
                  <span className="font-normal text-gray-400">(optional)</span>
                </label>
                <textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="e.g. this word appears twice in the meeting"
                  rows={2}
                  className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                />
              </div>

              <div className="flex gap-3">
                <Button type="button" variant="secondary" className="flex-1" onClick={onClose}>
                  Cancel
                </Button>
                <Button type="submit" className="flex-1" loading={loading}>
                  Submit flag
                </Button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
