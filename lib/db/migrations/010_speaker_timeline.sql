-- Migration 010: Add active_speaker_timeline column to meetings
-- Stores the RTC active-speaker timeline captured by the Chrome extension.
-- Each element: { name: string, timestampMs: number } — one per speaker-change event.
-- Used by the pipeline to automatically match SPEAKER_XX IDs to real participant names.

ALTER TABLE meetings
  ADD COLUMN IF NOT EXISTS active_speaker_timeline JSONB;
