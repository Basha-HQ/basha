'use client';

import { useRef, useState, useEffect } from 'react';
import { formatTimestamp } from '@/lib/utils/transcript';

interface Props {
  audioPath: string;
  /** Pre-computed timestamps (seconds) for each transcript segment — real or estimated */
  effectiveTimestamps: number[];
  onActiveSegmentChange: (index: number) => void;
  onRegisterSeek: (fn: (seconds: number) => void) => void;
  /** Called once when audio metadata loads so parent can compute estimated timestamps */
  onDurationLoad: (duration: number) => void;
}

const SPEEDS = [0.75, 1, 1.25, 1.5, 2] as const;

function findActiveSegmentIndex(timestamps: number[], time: number): number {
  let lo = 0, hi = timestamps.length - 1, result = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (timestamps[mid] <= time) { result = mid; lo = mid + 1; }
    else hi = mid - 1;
  }
  return result;
}

export function AudioPlayer({
  audioPath,
  effectiveTimestamps,
  onActiveSegmentChange,
  onRegisterSeek,
  onDurationLoad,
}: Props) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1);
  const isDraggingRef = useRef(false);

  // Sync is only meaningful when at least one timestamp is non-zero
  const hasTimestamps = effectiveTimestamps.some((t) => t > 0);

  // Register seek function with parent
  useEffect(() => {
    onRegisterSeek((seconds: number) => {
      if (!audioRef.current) return;
      audioRef.current.currentTime = seconds;
      setCurrentTime(seconds);
      if (hasTimestamps) {
        onActiveSegmentChange(findActiveSegmentIndex(effectiveTimestamps, seconds));
      }
    });
  }, [onRegisterSeek, effectiveTimestamps, onActiveSegmentChange, hasTimestamps]);

  // Sync playback rate to audio element
  useEffect(() => {
    if (audioRef.current) audioRef.current.playbackRate = playbackRate;
  }, [playbackRate]);

  function handleTimeUpdate() {
    if (!audioRef.current || isDraggingRef.current) return;
    const t = audioRef.current.currentTime;
    setCurrentTime(t);
    if (hasTimestamps) {
      onActiveSegmentChange(findActiveSegmentIndex(effectiveTimestamps, t));
    }
  }

  function togglePlay() {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
  }

  const pct = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div
      className="px-5 py-3"
      style={{
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        background: 'rgba(7,7,26,0.85)',
        backdropFilter: 'blur(8px)',
      }}
    >
      <audio
        ref={audioRef}
        src={audioPath}
        preload="metadata"
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={() => {
          const d = audioRef.current?.duration ?? 0;
          setDuration(d);
          onDurationLoad(d);
        }}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onEnded={() => { setIsPlaying(false); }}
      />

      <div className="flex items-center gap-3">
        {/* Play / Pause */}
        <button
          onClick={togglePlay}
          className="shrink-0 w-8 h-8 rounded-full flex items-center justify-center transition-colors cursor-pointer"
          style={{ background: 'rgba(245,158,11,0.15)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.3)' }}
          onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(245,158,11,0.25)')}
          onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(245,158,11,0.15)')}
          aria-label={isPlaying ? 'Pause' : 'Play'}
        >
          {isPlaying ? (
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
              <rect x="6" y="4" width="4" height="16" rx="1" />
              <rect x="14" y="4" width="4" height="16" rx="1" />
            </svg>
          ) : (
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
              <polygon points="5,3 19,12 5,21" />
            </svg>
          )}
        </button>

        {/* Time display */}
        <span
          className="text-xs font-mono tabular-nums shrink-0"
          style={{ color: 'rgba(255,255,255,0.4)', minWidth: '88px' }}
        >
          {formatTimestamp(Math.floor(currentTime))} / {formatTimestamp(Math.floor(duration))}
        </span>

        {/* Scrubber */}
        <div className="flex-1 relative">
          <input
            type="range"
            min={0}
            max={100}
            step={0.05}
            value={pct}
            className="audio-scrubber w-full"
            onChange={(e) => {
              const p = parseFloat(e.target.value);
              const t = (p / 100) * duration;
              setCurrentTime(t);
              if (audioRef.current) audioRef.current.currentTime = t;
              if (hasTimestamps) {
                onActiveSegmentChange(findActiveSegmentIndex(effectiveTimestamps, t));
              }
            }}
            onMouseDown={() => { isDraggingRef.current = true; }}
            onMouseUp={() => { isDraggingRef.current = false; }}
            onTouchStart={() => { isDraggingRef.current = true; }}
            onTouchEnd={() => { isDraggingRef.current = false; }}
            style={{ '--fill-pct': `${pct}%` } as React.CSSProperties}
          />
        </div>

        {/* Speed selector */}
        <div className="flex items-center gap-1 shrink-0">
          {SPEEDS.map((s) => (
            <button
              key={s}
              onClick={() => setPlaybackRate(s)}
              className="px-1.5 py-0.5 rounded text-xs font-semibold transition-all cursor-pointer"
              style={{
                color: playbackRate === s ? '#f59e0b' : 'rgba(255,255,255,0.3)',
                background: playbackRate === s ? 'rgba(245,158,11,0.12)' : 'transparent',
                border: `1px solid ${playbackRate === s ? 'rgba(245,158,11,0.3)' : 'rgba(255,255,255,0.07)'}`,
              }}
            >
              {s}x
            </button>
          ))}
        </div>
      </div>

      <style>{`
        .audio-scrubber {
          -webkit-appearance: none;
          appearance: none;
          height: 4px;
          border-radius: 2px;
          outline: none;
          cursor: pointer;
          background: linear-gradient(
            to right,
            #f59e0b 0%,
            #f59e0b ${pct}%,
            rgba(255,255,255,0.12) ${pct}%,
            rgba(255,255,255,0.12) 100%
          );
        }
        .audio-scrubber::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 13px;
          height: 13px;
          border-radius: 50%;
          background: #f59e0b;
          cursor: pointer;
          box-shadow: 0 0 0 2px rgba(245,158,11,0.25);
          transition: box-shadow 0.15s;
        }
        .audio-scrubber::-webkit-slider-thumb:hover {
          box-shadow: 0 0 0 4px rgba(245,158,11,0.2);
        }
        .audio-scrubber::-moz-range-thumb {
          width: 13px;
          height: 13px;
          border-radius: 50%;
          background: #f59e0b;
          border: none;
          cursor: pointer;
        }
        .audio-scrubber::-moz-range-track {
          height: 4px;
          border-radius: 2px;
          background: rgba(255,255,255,0.12);
        }
        .audio-scrubber::-moz-range-progress {
          height: 4px;
          border-radius: 2px;
          background: #f59e0b;
        }
      `}</style>
    </div>
  );
}
