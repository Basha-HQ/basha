-- Sprint 6: Persistent audio storage in PostgreSQL
-- Stores raw audio buffer so audio playback survives Railway restarts and Recall.ai URL expiry
ALTER TABLE meetings ADD COLUMN IF NOT EXISTS audio_data BYTEA;
