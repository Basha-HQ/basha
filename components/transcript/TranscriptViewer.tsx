'use client';

import { useState, useMemo } from 'react';
import { formatTimestamp } from '@/lib/utils/transcript';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { FlagModal } from './FlagModal';

interface TranscriptRow {
  id: string;
  segment_index: number;
  timestamp_seconds: number;
  original_text: string;
  english_text: string | null;
}

interface Props {
  meetingId: string;
  transcripts: TranscriptRow[];
  meetingTitle: string;
}

export function TranscriptViewer({ meetingId, transcripts, meetingTitle }: Props) {
  const [search, setSearch] = useState('');
  const [flagTarget, setFlagTarget] = useState<TranscriptRow | null>(null);
  const [downloading, setDownloading] = useState(false);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return transcripts;
    return transcripts.filter(
      (t) =>
        t.original_text.toLowerCase().includes(q) ||
        (t.english_text ?? '').toLowerCase().includes(q)
    );
  }, [search, transcripts]);

  async function handleDownload() {
    setDownloading(true);
    const res = await fetch(`/api/meetings/${meetingId}/transcript?download=true`);
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${meetingTitle.replace(/\s+/g, '-')}-transcript.txt`;
    a.click();
    URL.revokeObjectURL(url);
    setDownloading(false);
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-4">
            <h2 className="font-semibold text-gray-900 shrink-0">
              Transcript
              {search && (
                <span className="text-gray-400 font-normal text-sm ml-2">
                  {filtered.length} result{filtered.length !== 1 ? 's' : ''}
                </span>
              )}
            </h2>
            <div className="flex items-center gap-3 flex-1 max-w-sm">
              <Input
                placeholder="Search transcript..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="text-sm"
              />
            </div>
            <Button
              variant="secondary"
              size="sm"
              onClick={handleDownload}
              loading={downloading}
            >
              ⬇ Download TXT
            </Button>
          </div>
        </CardHeader>

        <CardBody className="p-0">
          {filtered.length === 0 ? (
            <div className="py-12 text-center text-gray-400">
              <p className="text-2xl mb-2">🔍</p>
              <p>No results for &quot;{search}&quot;</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {filtered.map((seg) => (
                <TranscriptSegment
                  key={seg.id}
                  segment={seg}
                  highlight={search}
                  onFlag={() => setFlagTarget(seg)}
                />
              ))}
            </div>
          )}
        </CardBody>
      </Card>

      {flagTarget && (
        <FlagModal
          segment={flagTarget}
          onClose={() => setFlagTarget(null)}
        />
      )}
    </>
  );
}

function highlight(text: string, query: string): React.ReactNode {
  if (!query.trim()) return text;
  const parts = text.split(new RegExp(`(${query})`, 'gi'));
  return parts.map((part, i) =>
    part.toLowerCase() === query.toLowerCase() ? (
      <mark key={i} className="bg-yellow-200 rounded px-0.5">
        {part}
      </mark>
    ) : (
      part
    )
  );
}

function TranscriptSegment({
  segment,
  highlight: q,
  onFlag,
}: {
  segment: TranscriptRow;
  highlight: string;
  onFlag: () => void;
}) {
  return (
    <div className="group px-6 py-4 hover:bg-gray-50 transition-colors">
      <div className="flex items-start gap-4">
        {/* Timestamp */}
        <span className="text-xs font-mono text-gray-400 mt-1 shrink-0 w-12">
          {formatTimestamp(segment.timestamp_seconds ?? 0)}
        </span>

        {/* Content */}
        <div className="flex-1 space-y-2">
          <div>
            <p className="text-xs font-semibold text-gray-400 mb-1">Original</p>
            <p className="text-gray-800 text-sm leading-relaxed">
              {highlight(segment.original_text, q)}
            </p>
          </div>
          {segment.english_text && (
            <div>
              <p className="text-xs font-semibold text-indigo-500 mb-1">English</p>
              <p className="text-gray-700 text-sm leading-relaxed">
                {highlight(segment.english_text, q)}
              </p>
            </div>
          )}
        </div>

        {/* Flag button */}
        <button
          onClick={onFlag}
          className="opacity-0 group-hover:opacity-100 transition-opacity text-gray-300 hover:text-red-400 shrink-0 text-sm mt-1"
          title="Flag incorrect transcript"
        >
          🚩
        </button>
      </div>
    </div>
  );
}
