-- Migration 011: Add processing_stage column to meetings
-- Tracks the sub-phase during status='processing' so the UI can show progressive feedback
-- ("Transcribing…" → "Translating…" → "Summarizing…") instead of a frozen state.
-- Values: 'transcribing' | 'translating' | 'summarizing' | NULL (when not actively processing).

ALTER TABLE meetings
  ADD COLUMN IF NOT EXISTS processing_stage TEXT;
