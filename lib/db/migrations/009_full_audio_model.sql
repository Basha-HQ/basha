-- Migration 009: Full-audio processing model
--
-- 1. upload_chunks.total_chunks is no longer used for completion detection
--    (replaced by isFinal flag from the extension). Make it nullable.
-- 2. Add UNIQUE constraint on transcripts(meeting_id, segment_index) to
--    prevent duplicate segment inserts as a safety net.

ALTER TABLE upload_chunks ALTER COLUMN total_chunks DROP NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'uniq_transcript_segment'
  ) THEN
    ALTER TABLE transcripts
      ADD CONSTRAINT uniq_transcript_segment UNIQUE (meeting_id, segment_index);
  END IF;
END $$;
