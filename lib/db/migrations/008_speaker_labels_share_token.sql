-- Sprint 7: Speaker labels + shareable transcript links

-- speaker_labels stores a JSONB map of raw speaker ID → user-provided name
-- e.g. { "SPEAKER_00": "Ravi", "SPEAKER_01": "Priya" }
ALTER TABLE meetings ADD COLUMN IF NOT EXISTS speaker_labels JSONB DEFAULT '{}';

-- share_token is a UUID generated on demand; NULL means the meeting is private
ALTER TABLE meetings ADD COLUMN IF NOT EXISTS share_token UUID;

CREATE UNIQUE INDEX IF NOT EXISTS idx_meetings_share_token ON meetings(share_token);
