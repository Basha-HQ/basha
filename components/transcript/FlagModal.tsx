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
  const [comment, setComment] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    await fetch(`/api/transcripts/${segment.id}/flag`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        flaggedText: segment.original_text,
        comment,
      }),
    });

    setLoading(false);
    setDone(true);
    setTimeout(onClose, 1500);
  }

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
        <div className="px-6 py-5 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">Flag transcript issue</h2>
          <p className="text-sm text-gray-400 mt-1">
            Help us improve by reporting incorrect transcriptions
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
                  What&apos;s wrong? (optional)
                </label>
                <textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="e.g. 'pannalam' was transcribed as 'panalam'"
                  rows={3}
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
