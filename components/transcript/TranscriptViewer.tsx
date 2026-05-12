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
  /**
   * Names scraped from the meeting DOM (e.g. Google Meet participant tiles).
   * Shown as suggestions in the speaker-rename banner so the user can confirm
   * with one click rather than typing from scratch.
   */
  suggestedParticipantNames?: string[];
  /** When true: hides flag button and disables speaker renaming (used on public share page) */
  readOnly?: boolean;
  /** Detected source language code e.g. "ta-IN" — shown as badge on ORIGINAL column */
  sourceLanguage?: string;
}

// Assign a consistent color per speaker label.
// Tints are bumped to match the Layout F design — gradient backgrounds need
// enough opacity to register against the dark navy card surface.
const SPEAKER_COLORS: Array<{ color: string; bg: string; border: string }> = [
  { color: '#f59e0b', bg: 'rgba(245,158,11,0.14)', border: 'rgba(245,158,11,0.28)' },
  { color: '#818cf8', bg: 'rgba(129,140,248,0.14)', border: 'rgba(129,140,248,0.28)' },
  { color: '#34d399', bg: 'rgba(52,211,153,0.12)', border: 'rgba(52,211,153,0.22)' },
  { color: '#fb7185', bg: 'rgba(251,113,133,0.12)', border: 'rgba(251,113,133,0.22)' },
  { color: '#a78bfa', bg: 'rgba(167,139,250,0.12)', border: 'rgba(167,139,250,0.22)' },
];

const LANG_NAMES: Record<string, string> = {
  'ta-IN': 'Tamil', 'hi-IN': 'Hindi', 'te-IN': 'Telugu',
  'kn-IN': 'Kannada', 'ml-IN': 'Malayalam', 'mr-IN': 'Marathi',
  'bn-IN': 'Bengali', 'gu-IN': 'Gujarati', 'pa-IN': 'Punjabi',
  'en-IN': 'English', auto: 'Auto', unknown: 'Auto',
};

function getSpeakerColor(speaker: string, speakerMap: Map<string, number>) {
  if (!speakerMap.has(speaker)) {
    speakerMap.set(speaker, speakerMap.size);
  }
  return SPEAKER_COLORS[speakerMap.get(speaker)! % SPEAKER_COLORS.length];
}

function speakerLabel(speaker: string, labels?: Record<string, string>): string {
  if (labels?.[speaker]) return labels[speaker];
  const match = speaker.match(/(\d+)$/);
  if (match) return `Speaker ${parseInt(match[1], 10) + 1}`;
  return speaker;
}

function speakerInitial(speaker: string, labels?: Record<string, string>): string {
  const label = speakerLabel(speaker, labels);
  return label.charAt(0).toUpperCase();
}

export function TranscriptViewer({ meetingId, transcripts, meetingTitle, audioPath, knownDuration, flaggedSegmentIds, speakerLabels: initialSpeakerLabels, suggestedParticipantNames, readOnly, sourceLanguage }: Props) {
  const [search, setSearch] = useState('');
  const [flagTarget, setFlagTarget] = useState<TranscriptRow | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [activeSegmentIndex, setActiveSegmentIndex] = useState(-1);
  const [speakerLabels, setSpeakerLabels] = useState<Record<string, string>>(initialSpeakerLabels ?? {});
  const [audioDuration, setAudioDuration] = useState(knownDuration ?? 0);
  const [bannerDismissed, setBannerDismissed] = useState(false);

  const segmentRefs = useRef<Array<HTMLDivElement | null>>([]);
  const seekAudioRef = useRef<((s: number) => void) | null>(null);

  const handleRegisterSeek = useCallback((fn: (s: number) => void) => {
    seekAudioRef.current = fn;
  }, []);

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

  useEffect(() => {
    if (activeSegmentIndex < 0 || search.trim()) return;
    segmentRefs.current[activeSegmentIndex]?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [activeSegmentIndex, search]);

  async function handleRenameSpeaker(rawSpeaker: string, newName: string) {
    const trimmed = newName.trim();
    const updated = { ...speakerLabels, [rawSpeaker]: trimmed || rawSpeaker };
    setSpeakerLabels(updated);
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
  const langBadge = sourceLanguage ? (LANG_NAMES[sourceLanguage] ?? sourceLanguage) : null;

  // Slug + label for the WindowChrome path strip
  const meetingPath = (meetingTitle || 'meeting')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 28) || 'meeting';
  const chromeLang = langBadge ? langBadge.toLowerCase() : 'mixed';
  const titlePill = meetingTitle && meetingTitle.length > 0 ? meetingTitle : 'Meeting';

  return (
    <>
      <div
        className="rounded-2xl"
        style={{
          background: '#07071a',
          border: '1px solid rgba(255,255,255,0.07)',
          overflow: 'clip',
        }}
      >
        {/* Window Chrome — Layout F context strip */}
        <div
          className="flex items-center"
          style={{
            gap: 10,
            padding: '10px 14px',
            borderBottom: '1px solid rgba(255,255,255,0.07)',
            background: 'rgba(255,255,255,0.025)',
          }}
        >
          <div className="flex" style={{ gap: 5 }}>
            {['#ff5f57', '#febc2e', '#28c840'].map((c, i) => (
              <div key={i} style={{ width: 10, height: 10, borderRadius: '50%', background: c }} />
            ))}
          </div>
          <span
            className="truncate"
            style={{
              fontFamily: 'monospace',
              fontSize: 10,
              color: 'rgba(255,255,255,0.25)',
              flex: 1,
            }}
          >
            basha · {meetingPath} · {chromeLang}
          </span>
          <span
            className="truncate"
            style={{
              fontSize: 10,
              fontWeight: 700,
              padding: '2px 8px',
              borderRadius: 99,
              background: 'rgba(245,158,11,0.12)',
              color: '#f59e0b',
              border: '1px solid rgba(245,158,11,0.28)',
              maxWidth: 220,
            }}
            title={titlePill}
          >
            {titlePill}
          </span>
        </div>

        {/* Utility header — search + download */}
        <div
          className="px-6 pt-4 pb-3 flex items-center justify-between gap-4"
          style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}
        >
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

        {/* Audio player */}
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

        {/* Speaker name suggestion banner — shown when speakers are unidentified */}
        {!readOnly && !bannerDismissed && (() => {
          // Find unique speaker IDs in the transcript
          const uniqueSpeakers = [...new Set(transcripts.map((t) => t.speaker).filter(Boolean))] as string[];
          // Show banner if any speaker is still using a generic label (no real name assigned)
          const hasUnnamed = uniqueSpeakers.some((s) => !speakerLabels[s] || speakerLabels[s] === s);
          if (!hasUnnamed || uniqueSpeakers.length === 0) return null;

          // Suggestions: use DOM-scraped names if available, else empty slots
          const suggestions = uniqueSpeakers.map((speakerId, i) => ({
            speakerId,
            currentName: speakerLabels[speakerId] && speakerLabels[speakerId] !== speakerId
              ? speakerLabels[speakerId]
              : '',
            suggestedName: suggestedParticipantNames?.[i] ?? '',
          }));

          return (
            <div
              className="mx-4 my-3 rounded-xl px-4 py-3 flex flex-col gap-3"
              style={{ background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)' }}
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-semibold" style={{ color: 'rgba(255,255,255,0.7)' }}>
                  Who are the speakers? Add names to personalise the transcript.
                </p>
                <button
                  onClick={() => setBannerDismissed(true)}
                  className="text-xs shrink-0 transition-colors"
                  style={{ color: 'rgba(255,255,255,0.25)' }}
                >
                  Dismiss
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {suggestions.map(({ speakerId, currentName, suggestedName }) => (
                  <SpeakerNameInput
                    key={speakerId}
                    speakerId={speakerId}
                    currentName={currentName}
                    suggestedName={suggestedName}
                    onConfirm={(name) => handleRenameSpeaker(speakerId, name)}
                  />
                ))}
              </div>
            </div>
          );
        })()}

        {/* Segments — Layout F: Soft Cards + Whisper */}
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
          <div
            className={audioPath ? 'overflow-y-auto max-h-[65vh]' : undefined}
            style={{ padding: '20px 18px', display: 'flex', flexDirection: 'column', gap: 10 }}
          >
            {filtered.map((seg, idx) => {
              const fullIdx = transcripts.findIndex((t) => t.id === seg.id);
              const displayTs = fullIdx >= 0 ? effectiveTimestamps[fullIdx] : (seg.timestamp_seconds ?? 0);
              return (
                <TranscriptRow
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
                  langBadge={langBadge ?? undefined}
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

function TranscriptRow({
  segment,
  displayTimestamp,
  highlight,
  onFlag,
  speakerMap,
  speakerLabels,
  onRenameSpeaker,
  isActive,
  isFlagged,
  onSeek,
  langBadge,
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
  langBadge?: string;
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

  const label = segment.speaker ? speakerLabel(segment.speaker, speakerLabels) : null;
  const initial = segment.speaker ? speakerInitial(segment.speaker, speakerLabels) : null;

  // Pure-English: original and english match (case-insensitive trim) → no whisper
  const enText = segment.english_text?.trim() ?? '';
  const ogText = segment.original_text?.trim() ?? '';
  const isPureEnglish = !enText || enText.toLowerCase() === ogText.toLowerCase();

  // Card background: slate wash for English, speaker-tinted gradient for non-English
  const cardBackground = isPureEnglish
    ? 'rgba(255,255,255,0.025)'
    : sc
      ? `linear-gradient(180deg, ${sc.bg} 0%, rgba(13,13,34,0) 90%)`
      : 'rgba(255,255,255,0.025)';

  return (
    <div
      ref={domRef}
      className="group transition-colors"
      style={{
        padding: '14px 16px',
        borderRadius: 14,
        background: cardBackground,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        borderLeft: isActive ? '2px solid rgba(245,158,11,0.6)' : '2px solid transparent',
        boxShadow: isActive ? '0 0 0 1px rgba(245,158,11,0.18)' : 'none',
      }}
    >
      {/* Header row — avatar + speaker + timestamp + (optional) language tag + flag */}
      <div className="flex items-center" style={{ gap: 9 }}>
        {/* Avatar 26px */}
        {segment.speaker && sc ? (
          <div
            className="rounded-full flex items-center justify-center shrink-0 font-bold"
            style={{
              width: 26, height: 26, fontSize: 10,
              background: sc.bg, color: sc.color, border: `1px solid ${sc.border}`,
            }}
          >
            {initial}
          </div>
        ) : (
          <div
            className="rounded-full flex items-center justify-center shrink-0 font-bold"
            style={{
              width: 26, height: 26, fontSize: 10,
              background: 'rgba(255,255,255,0.04)',
              color: 'rgba(255,255,255,0.2)',
              border: '1px solid rgba(255,255,255,0.08)',
            }}
          >
            ?
          </div>
        )}

        {/* Speaker name (editable) */}
        {segment.speaker && sc && label ? (
          editing ? (
            <input
              autoFocus
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onBlur={commitEdit}
              onKeyDown={(e) => { if (e.key === 'Enter') commitEdit(); if (e.key === 'Escape') setEditing(false); }}
              className="outline-none rounded px-1"
              style={{
                fontSize: 12.5, fontWeight: 700,
                color: sc.color, background: sc.bg,
                border: `1px solid ${sc.color}`, minWidth: 60, maxWidth: 140,
              }}
            />
          ) : (
            <button
              onClick={startEdit}
              title={onRenameSpeaker ? 'Click to rename speaker' : undefined}
              className={`${onRenameSpeaker ? 'cursor-pointer hover:opacity-80' : 'cursor-default'} transition-opacity`}
              style={{ fontSize: 12.5, fontWeight: 700, color: sc.color }}
            >
              {label}
            </button>
          )
        ) : null}

        {/* Timestamp */}
        {onSeek ? (
          <button
            onClick={onSeek}
            className="hover:opacity-70 transition-opacity cursor-pointer tabular-nums"
            style={{ fontSize: 10.5, fontFamily: 'monospace', color: 'rgba(255,255,255,0.25)' }}
            title="Seek to this point"
          >
            {formatTimestamp(displayTimestamp)}
          </button>
        ) : (
          <span
            className="tabular-nums"
            style={{ fontSize: 10.5, fontFamily: 'monospace', color: 'rgba(255,255,255,0.25)' }}
          >
            {formatTimestamp(displayTimestamp)}
          </span>
        )}

        {/* Language tag (only on non-English segments) — pushed to the right */}
        {!isPureEnglish && langBadge && (
          <span className="flex items-center" style={{ gap: 5, marginLeft: 'auto' }}>
            <span
              style={{
                width: 5, height: 5, borderRadius: 99,
                background: '#f59e0b', opacity: 0.7,
              }}
            />
            <span
              style={{
                fontSize: 10, fontWeight: 600, letterSpacing: '0.02em',
                color: 'rgba(245,158,11,0.7)',
                textTransform: 'lowercase',
              }}
            >
              {langBadge}
            </span>
          </span>
        )}

        {/* Flag button — pushed to right when no language tag, after when there is one */}
        {onFlag && (
          <button
            onClick={onFlag}
            className={`transition-opacity shrink-0 p-1 rounded-md cursor-pointer ${
              isFlagged ? 'opacity-60' : 'opacity-0 group-hover:opacity-100'
            }`}
            style={{
              color: isFlagged ? '#fb7185' : 'rgba(255,255,255,0.2)',
              marginLeft: !isPureEnglish && langBadge ? 4 : 'auto',
            }}
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

      {/* Original body */}
      <p
        style={{
          fontSize: 13.5, lineHeight: 1.7,
          color: 'rgba(255,255,255,0.88)',
          paddingLeft: 35,
          textWrap: 'pretty' as React.CSSProperties['textWrap'],
        }}
      >
        {highlightText(segment.original_text, highlight)}
      </p>

      {/* Whisper EN block — only on non-English segments with a translation */}
      {!isPureEnglish && segment.english_text && (
        <div
          style={{
            paddingLeft: 35, paddingTop: 2,
            display: 'flex', gap: 10, alignItems: 'flex-start',
          }}
        >
          <span
            style={{
              fontSize: 9.5, fontWeight: 700, letterSpacing: '0.12em',
              textTransform: 'uppercase',
              color: 'rgba(165,180,252,0.45)',
              paddingTop: 3, flexShrink: 0,
            }}
          >
            EN
          </span>
          <p
            style={{
              fontSize: 13, lineHeight: 1.65,
              color: 'rgba(165,180,252,0.7)',
              textWrap: 'pretty' as React.CSSProperties['textWrap'],
            }}
          >
            {highlightText(segment.english_text, highlight)}
          </p>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// SpeakerNameInput — inline chip for confirming/typing a speaker name
// ---------------------------------------------------------------------------

function SpeakerNameInput({
  speakerId,
  currentName,
  suggestedName,
  onConfirm,
}: {
  speakerId: string;
  currentName: string;
  suggestedName: string;
  onConfirm: (name: string) => void;
}) {
  const displayId = speakerId.match(/(\d+)$/)
    ? `Speaker ${parseInt(speakerId.match(/(\d+)$/)![1], 10) + 1}`
    : speakerId;

  const [value, setValue] = useState(currentName || suggestedName);
  const [saved, setSaved] = useState(!!currentName);

  function handleConfirm() {
    if (!value.trim()) return;
    onConfirm(value.trim());
    setSaved(true);
  }

  if (saved) {
    return (
      <div
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs"
        style={{ background: 'rgba(52,211,153,0.1)', border: '1px solid rgba(52,211,153,0.2)', color: '#34d399' }}
      >
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 6 9 17 4 12"/>
        </svg>
        <span className="font-semibold">{displayId}</span>
        <span style={{ color: 'rgba(255,255,255,0.5)' }}>= {value}</span>
        <button
          onClick={() => setSaved(false)}
          className="ml-1 transition-opacity"
          style={{ color: 'rgba(255,255,255,0.25)', fontSize: '10px' }}
          title="Edit"
        >
          edit
        </button>
      </div>
    );
  }

  return (
    <div
      className="flex items-center gap-1.5 rounded-xl overflow-hidden"
      style={{ border: '1px solid rgba(99,102,241,0.3)', background: 'rgba(99,102,241,0.06)' }}
    >
      <span
        className="px-2 py-1.5 text-xs font-semibold shrink-0"
        style={{ color: 'rgba(255,255,255,0.45)', borderRight: '1px solid rgba(99,102,241,0.2)' }}
      >
        {displayId}
      </span>
      <input
        className="bg-transparent text-xs outline-none px-2 py-1.5 w-28"
        style={{ color: 'rgba(255,255,255,0.85)' }}
        placeholder={suggestedName || 'Enter name…'}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') handleConfirm(); }}
      />
      {value.trim() && (
        <button
          onClick={handleConfirm}
          className="px-2 py-1.5 text-xs font-semibold shrink-0 transition-colors"
          style={{ color: '#6366f1' }}
        >
          Save
        </button>
      )}
    </div>
  );
}
