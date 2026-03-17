'use client';

import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { formatTimestamp } from '@/lib/utils/transcript';
import { FlagModal } from './FlagModal';
import { AudioPlayer } from './AudioPlayer';

interface TranscriptRow {
  id: string;
  segment_index: number;
  timestamp_seconds: number;
  original_text: string;
  english_text: string | null;
  speaker: string | null;
}

interface Props {
  meetingId: string;
  transcripts: TranscriptRow[];
  meetingTitle: string;
  audioPath?: string;
  /** Duration in seconds from the DB — used to compute estimated timestamps before audio loads */
  knownDuration?: number;
  flaggedSegmentIds?: string[];
  /** User-provided speaker display names — keys are raw IDs like "SPEAKER_00" */
  speakerLabels?: Record<string, string>;
  /** When true: hides flag button and disables speaker renaming (used on public share page) */
  readOnly?: boolean;
}

// Assign a consistent color per speaker label
const SPEAKER_COLORS: Array<{ color: string; bg: string; border: string }> = [
  { color: '#f59e0b', bg: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.25)' },
  { color: '#6366f1', bg: 'rgba(99,102,241,0.12)', border: 'rgba(99,102,241,0.25)' },
  { color: '#34d399', bg: 'rgba(52,211,153,0.1)', border: 'rgba(52,211,153,0.2)' },
  { color: '#fb7185', bg: 'rgba(251,113,133,0.1)', border: 'rgba(251,113,133,0.2)' },
  { color: '#a78bfa', bg: 'rgba(167,139,250,0.1)', border: 'rgba(167,139,250,0.2)' },
];

function getSpeakerColor(speaker: string, speakerMap: Map<string, number>) {
  if (!speakerMap.has(speaker)) {
    speakerMap.set(speaker, speakerMap.size);
  }
  return SPEAKER_COLORS[speakerMap.get(speaker)! % SPEAKER_COLORS.length];
}

function speakerLabel(speaker: string, labels?: Record<string, string>): string {
  if (labels?.[speaker]) return labels[speaker];
  // "SPEAKER_00" → "Speaker 1", "SPEAKER_01" → "Speaker 2", etc.
  const match = speaker.match(/(\d+)$/);
  if (match) return `Speaker ${parseInt(match[1], 10) + 1}`;
  return speaker;
}

type ViewMode = 'original' | 'both' | 'english';

export function TranscriptViewer({ meetingId, transcripts, meetingTitle, audioPath, knownDuration, flaggedSegmentIds, speakerLabels: initialSpeakerLabels, readOnly }: Props) {
  const [search, setSearch] = useState('');
  const [flagTarget, setFlagTarget] = useState<TranscriptRow | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [activeSegmentIndex, setActiveSegmentIndex] = useState(-1);
  const [viewMode, setViewMode] = useState<ViewMode>('both');
  const [speakerLabels, setSpeakerLabels] = useState<Record<string, string>>(initialSpeakerLabels ?? {});
  // Pre-seed with DB duration so estimated timestamps work before audio loads
  const [audioDuration, setAudioDuration] = useState(knownDuration ?? 0);

  const segmentRefs = useRef<Array<HTMLDivElement | null>>([]);
  const seekAudioRef = useRef<((s: number) => void) | null>(null);

  // Stable callback — prevents AudioPlayer's seek-registration useEffect from
  // re-running on every render due to inline arrow function reference changes.
  const handleRegisterSeek = useCallback((fn: (s: number) => void) => {
    seekAudioRef.current = fn;
  }, []);

  // Compute effective timestamps: use real DB values if available, otherwise distribute
  // evenly across the known audio duration for existing recordings that have all-zero timestamps.
  const effectiveTimestamps = useMemo(() => {
    const hasReal = transcripts.some((t) => (t.timestamp_seconds ?? 0) > 0);
    if (hasReal) return transcripts.map((t) => t.timestamp_seconds ?? 0);
    if (audioDuration > 0 && transcripts.length > 0) {
      return transcripts.map((_, i) =>
        Math.round((i / transcripts.length) * audioDuration)
      );
    }
    return transcripts.map(() => 0);
  }, [transcripts, audioDuration]);

  // Build a stable speaker → index map from all transcripts (not just filtered)
  const speakerMap = useMemo(() => {
    const map = new Map<string, number>();
    transcripts.forEach((t) => {
      if (t.speaker && !map.has(t.speaker)) map.set(t.speaker, map.size);
    });
    return map;
  }, [transcripts]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return transcripts;
    return transcripts.filter(
      (t) =>
        t.original_text.toLowerCase().includes(q) ||
        (t.english_text ?? '').toLowerCase().includes(q)
    );
  }, [search, transcripts]);

  // Auto-scroll to active segment (suppressed during search to avoid interrupting the user)
  useEffect(() => {
    if (activeSegmentIndex < 0 || search.trim()) return;
    segmentRefs.current[activeSegmentIndex]?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [activeSegmentIndex, search]);

  async function handleRenameSpeaker(rawSpeaker: string, newName: string) {
    const trimmed = newName.trim();
    const updated = { ...speakerLabels, [rawSpeaker]: trimmed || rawSpeaker };
    setSpeakerLabels(updated); // optimistic
    await fetch(`/api/meetings/${meetingId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ speaker_labels: updated }),
    });
  }

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

  const activeSegmentId = activeSegmentIndex >= 0 ? transcripts[activeSegmentIndex]?.id : null;

  return (
    <>
      <div
        className="rounded-2xl"
        style={{
          background: 'rgba(255,255,255,0.03)',
          border: '1px solid rgba(255,255,255,0.07)',
          overflow: 'clip',
        }}
      >
        {/* Header */}
        <div
          className="px-6 pt-4 pb-3 flex flex-col gap-3"
          style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}
        >
          {/* Top row: title + search + download */}
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2.5 shrink-0">
              <div
                className="w-7 h-7 rounded-lg flex items-center justify-center"
                style={{ background: 'rgba(245,158,11,0.12)', color: '#f59e0b' }}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
                </svg>
              </div>
              <h2 className="font-semibold text-sm" style={{ color: 'rgba(255,255,255,0.9)' }}>
                Transcript
                {search && (
                  <span className="font-normal text-xs ml-2" style={{ color: 'rgba(255,255,255,0.35)' }}>
                    {filtered.length} result{filtered.length !== 1 ? 's' : ''}
                  </span>
                )}
              </h2>
            </div>

            <div className="flex items-center gap-3 flex-1 max-w-xs">
              {/* Search */}
              <div className="relative flex-1">
                <svg
                  className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                  width="13" height="13" viewBox="0 0 24 24" fill="none"
                  stroke="rgba(255,255,255,0.3)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                >
                  <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                </svg>
                <input
                  type="text"
                  placeholder="Search transcript…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 rounded-lg text-xs transition-colors outline-none"
                  style={{
                    background: 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    color: 'rgba(255,255,255,0.85)',
                  }}
                />
              </div>
            </div>

            {/* Download */}
            <button
              onClick={handleDownload}
              disabled={downloading}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold shrink-0 transition-opacity disabled:opacity-50 cursor-pointer"
              style={{
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.1)',
                color: 'rgba(255,255,255,0.55)',
              }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
              </svg>
              {downloading ? 'Downloading…' : 'Download TXT'}
            </button>
          </div>

          {/* Dual-output toggle — Basha's #1 USP, prominent */}
          <div className="flex items-center gap-2">
            <span className="text-xs shrink-0" style={{ color: 'rgba(255,255,255,0.3)' }}>View:</span>
            <div
              className="flex gap-0.5 p-0.5 rounded-xl"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
            >
              {([
                { mode: 'original' as ViewMode, label: 'Original' },
                { mode: 'both' as ViewMode, label: 'Both' },
                { mode: 'english' as ViewMode, label: 'English' },
              ] as const).map(({ mode, label }) => (
                <button
                  key={mode}
                  onClick={() => setViewMode(mode)}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer"
                  style={viewMode === mode ? {
                    background: 'rgba(245,158,11,0.15)',
                    color: '#f59e0b',
                    border: '1px solid rgba(245,158,11,0.3)',
                  } : {
                    background: 'transparent',
                    color: 'rgba(255,255,255,0.4)',
                    border: '1px solid transparent',
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Audio player — only when audioPath is provided */}
        {audioPath && (
          <AudioPlayer
            audioPath={audioPath}
            effectiveTimestamps={effectiveTimestamps}
            onActiveSegmentChange={setActiveSegmentIndex}
            onRegisterSeek={handleRegisterSeek}
            onDurationLoad={setAudioDuration}
            knownDuration={knownDuration}
          />
        )}

        {/* Segments */}
        {filtered.length === 0 ? (
          <div className="py-16 text-center">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center mx-auto mb-3"
              style={{ background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.2)' }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
            </div>
            <p className="text-sm" style={{ color: 'rgba(255,255,255,0.35)' }}>
              No results for &ldquo;{search}&rdquo;
            </p>
          </div>
        ) : (
          <div className={audioPath ? 'overflow-y-auto max-h-[65vh]' : undefined}>
            {filtered.map((seg, idx) => {
              const fullIdx = transcripts.findIndex((t) => t.id === seg.id);
              const displayTs = fullIdx >= 0 ? effectiveTimestamps[fullIdx] : (seg.timestamp_seconds ?? 0);
              return (
                <TranscriptSegment
                  key={seg.id}
                  segment={seg}
                  displayTimestamp={displayTs}
                  highlight={search}
                  onFlag={readOnly ? undefined : () => setFlagTarget(seg)}
                  speakerMap={speakerMap}
                  speakerLabels={speakerLabels}
                  onRenameSpeaker={readOnly ? undefined : handleRenameSpeaker}
                  isLast={idx === filtered.length - 1}
                  isActive={seg.id === activeSegmentId}
                  isFlagged={flaggedSegmentIds?.includes(seg.id) ?? false}
                  onSeek={audioPath ? () => { seekAudioRef.current?.(displayTs); } : undefined}
                  viewMode={viewMode}
                  domRef={(el) => {
                    if (fullIdx >= 0) segmentRefs.current[fullIdx] = el;
                  }}
                />
              );
            })}
          </div>
        )}
      </div>

      {flagTarget && (
        <FlagModal segment={flagTarget} onClose={() => setFlagTarget(null)} />
      )}
    </>
  );
}

function highlightText(text: string, query: string): React.ReactNode {
  if (!query.trim()) return text;
  const parts = text.split(new RegExp(`(${query})`, 'gi'));
  return parts.map((part, i) =>
    part.toLowerCase() === query.toLowerCase() ? (
      <mark
        key={i}
        style={{ background: 'rgba(245,158,11,0.28)', color: 'inherit', borderRadius: '2px', padding: '0 2px' }}
      >
        {part}
      </mark>
    ) : (
      part
    )
  );
}

function TranscriptSegment({
  segment,
  displayTimestamp,
  highlight,
  onFlag,
  speakerMap,
  speakerLabels,
  onRenameSpeaker,
  isLast,
  isActive,
  isFlagged,
  onSeek,
  viewMode,
  domRef,
}: {
  segment: TranscriptRow;
  displayTimestamp: number;
  highlight: string;
  onFlag?: () => void;
  speakerMap: Map<string, number>;
  speakerLabels?: Record<string, string>;
  onRenameSpeaker?: (rawSpeaker: string, newName: string) => void;
  isLast: boolean;
  isActive?: boolean;
  isFlagged?: boolean;
  onSeek?: () => void;
  viewMode?: ViewMode;
  domRef?: (el: HTMLDivElement | null) => void;
}) {
  const sc = segment.speaker ? getSpeakerColor(segment.speaker, speakerMap) : null;
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState('');

  function startEdit() {
    if (!segment.speaker || !onRenameSpeaker) return;
    setEditValue(speakerLabel(segment.speaker, speakerLabels));
    setEditing(true);
  }

  function commitEdit() {
    if (segment.speaker && onRenameSpeaker) {
      onRenameSpeaker(segment.speaker, editValue);
    }
    setEditing(false);
  }

  return (
    <div
      className="group px-6 py-4 transition-colors"
      ref={domRef}
      style={{
        borderBottom: isLast ? 'none' : '1px solid rgba(255,255,255,0.05)',
        borderLeft: isActive ? '2px solid rgba(245,158,11,0.5)' : '2px solid transparent',
        background: isActive ? 'rgba(245,158,11,0.06)' : 'transparent',
      }}
      onMouseEnter={(e) => {
        if (!isActive) e.currentTarget.style.background = 'rgba(255,255,255,0.02)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = isActive ? 'rgba(245,158,11,0.06)' : 'transparent';
      }}
    >
      <div className="flex items-start gap-4">
        {/* Timestamp — clickable when audio is available */}
        {onSeek ? (
          <button
            onClick={onSeek}
            className="text-xs font-mono mt-0.5 shrink-0 w-10 tabular-nums hover:opacity-70 transition-opacity cursor-pointer"
            style={{ color: '#f59e0b' }}
            title="Seek to this point"
          >
            {formatTimestamp(displayTimestamp)}
          </button>
        ) : (
          <span
            className="text-xs font-mono mt-0.5 shrink-0 w-10 tabular-nums"
            style={{ color: '#f59e0b' }}
          >
            {formatTimestamp(displayTimestamp)}
          </span>
        )}

        {/* Content */}
        <div className="flex-1 min-w-0 space-y-2">
          {/* Speaker chip — click to rename */}
          {segment.speaker && sc && (
            editing ? (
              <input
                autoFocus
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                onBlur={commitEdit}
                onKeyDown={(e) => { if (e.key === 'Enter') commitEdit(); if (e.key === 'Escape') setEditing(false); }}
                className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold outline-none"
                style={{ color: sc.color, background: sc.bg, border: `1px solid ${sc.color}`, minWidth: '80px', maxWidth: '160px' }}
              />
            ) : (
              <button
                onClick={startEdit}
                title="Click to rename speaker"
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-semibold cursor-pointer transition-opacity hover:opacity-80"
                style={{ color: sc.color, background: sc.bg, border: `1px solid ${sc.border}` }}
              >
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: sc.color }} />
                {speakerLabel(segment.speaker, speakerLabels)}
                {onRenameSpeaker && (
                  <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="opacity-50 ml-0.5">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                  </svg>
                )}
              </button>
            )
          )}

          {/* Original text */}
          {(viewMode === 'original' || viewMode === 'both' || !viewMode) && (
            <div>
              {viewMode === 'both' && (
                <p className="text-xs font-medium mb-0.5" style={{ color: 'rgba(255,255,255,0.3)' }}>
                  Original
                </p>
              )}
              <p className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.82)' }}>
                {highlightText(segment.original_text, highlight)}
              </p>
            </div>
          )}

          {/* English translation */}
          {segment.english_text && (viewMode === 'english' || viewMode === 'both' || !viewMode) && (
            <div>
              {viewMode === 'both' && (
                <p className="text-xs font-medium mb-0.5" style={{ color: '#6366f1' }}>
                  English
                </p>
              )}
              <p className="text-sm leading-relaxed" style={{ color: viewMode === 'english' ? 'rgba(255,255,255,0.82)' : 'rgba(255,255,255,0.6)' }}>
                {highlightText(segment.english_text, highlight)}
              </p>
            </div>
          )}
        </div>

        {/* Flag button — only shown when not readOnly */}
        {onFlag && (
          <button
            onClick={onFlag}
            className={`transition-opacity shrink-0 mt-0.5 p-1 rounded-md cursor-pointer ${
              isFlagged ? 'opacity-60' : 'opacity-0 group-hover:opacity-100'
            }`}
            style={{ color: isFlagged ? '#fb7185' : 'rgba(255,255,255,0.2)' }}
            title={isFlagged ? 'Already flagged — click to update' : 'Flag incorrect transcript'}
            onMouseEnter={(e) => (e.currentTarget.style.color = '#fb7185')}
            onMouseLeave={(e) => (e.currentTarget.style.color = isFlagged ? '#fb7185' : 'rgba(255,255,255,0.2)')}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
              fill={isFlagged ? 'currentColor' : 'none'}
              stroke="currentColor"
            >
              <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/>
              <line x1="4" y1="22" x2="4" y2="15"/>
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}
