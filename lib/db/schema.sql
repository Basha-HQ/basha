-- LinguaMeet Database Schema

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(255),
  password_hash VARCHAR(255), -- null for OAuth users
  plan_type VARCHAR(50) DEFAULT 'free' CHECK (plan_type IN ('free', 'paid')),
  preferred_languages   TEXT[]  DEFAULT '{}',
  output_language       TEXT    DEFAULT 'en',
  meeting_platform      TEXT    DEFAULT 'both',
  onboarding_completed       BOOLEAN DEFAULT false,
  google_access_token        TEXT,
  google_refresh_token       TEXT,
  google_token_expiry        TIMESTAMPTZ,
  google_calendar_connected  BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- OTP verifications (for future email OTP signup — TODO sprint)
CREATE TABLE IF NOT EXISTS otp_verifications (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email       VARCHAR(255) NOT NULL,
  otp_code    VARCHAR(6)   NOT NULL,
  expires_at  TIMESTAMPTZ  NOT NULL,
  used        BOOLEAN      DEFAULT false,
  created_at  TIMESTAMPTZ  DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_otp_email ON otp_verifications(email);

-- Accounts table (for NextAuth OAuth)
CREATE TABLE IF NOT EXISTS accounts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type VARCHAR(255) NOT NULL,
  provider VARCHAR(255) NOT NULL,
  provider_account_id VARCHAR(255) NOT NULL,
  refresh_token TEXT,
  access_token TEXT,
  expires_at BIGINT,
  token_type VARCHAR(255),
  scope VARCHAR(255),
  id_token TEXT,
  session_state VARCHAR(255),
  UNIQUE(provider, provider_account_id)
);

-- Sessions table (for NextAuth)
CREATE TABLE IF NOT EXISTS sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_token VARCHAR(255) UNIQUE NOT NULL,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires TIMESTAMPTZ NOT NULL
);

-- Verification tokens (for NextAuth email magic links)
CREATE TABLE IF NOT EXISTS verification_tokens (
  identifier VARCHAR(255) NOT NULL,
  token VARCHAR(255) NOT NULL,
  expires TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (identifier, token)
);

-- Meetings table
CREATE TABLE IF NOT EXISTS meetings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  meeting_link TEXT,
  platform VARCHAR(50) CHECK (platform IN ('google_meet', 'zoom', 'other')),
  title VARCHAR(255) DEFAULT 'Untitled Meeting',
  status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'recording', 'processing', 'completed', 'failed')),
  duration INTEGER, -- in seconds
  audio_path TEXT,
  summary TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- Transcripts table
CREATE TABLE IF NOT EXISTS transcripts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  meeting_id UUID NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
  segment_index INTEGER NOT NULL, -- ordering within meeting
  timestamp_seconds INTEGER, -- seconds from meeting start
  original_text TEXT NOT NULL,
  english_text TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Flags table (user feedback on transcript errors)
CREATE TABLE IF NOT EXISTS flags (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  transcript_id UUID NOT NULL REFERENCES transcripts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  flagged_text TEXT,
  user_comment TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_meetings_user_id ON meetings(user_id);
CREATE INDEX IF NOT EXISTS idx_meetings_status ON meetings(status);
CREATE INDEX IF NOT EXISTS idx_transcripts_meeting_id ON transcripts(meeting_id);
CREATE INDEX IF NOT EXISTS idx_transcripts_segment_index ON transcripts(meeting_id, segment_index);
CREATE INDEX IF NOT EXISTS idx_flags_transcript_id ON flags(transcript_id);

-- Full-text search index on transcripts
CREATE INDEX IF NOT EXISTS idx_transcripts_fts ON transcripts
  USING GIN(to_tsvector('english', COALESCE(original_text, '') || ' ' || COALESCE(english_text, '')));

-- Bots table (Recall.ai integration)
-- One bot per meeting; tracks lifecycle: idle → joining → in_meeting → recording → leaving → processing → completed/failed
CREATE TABLE IF NOT EXISTS bots (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  meeting_id UUID NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
  meeting_url TEXT NOT NULL,
  recall_bot_id TEXT UNIQUE, -- Recall.ai bot ID for API calls
  status VARCHAR(50) NOT NULL DEFAULT 'idle'
    CHECK (status IN ('idle', 'joining', 'in_meeting', 'recording', 'leaving', 'processing', 'completed', 'failed')),
  error TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bots_meeting_id ON bots(meeting_id);
CREATE INDEX IF NOT EXISTS idx_bots_status ON bots(status);

-- ── Sprint 2 additions ─────────────────────────────────────────────────────────

-- Per-meeting language preference (overrides user-level defaults)
ALTER TABLE meetings
  ADD COLUMN IF NOT EXISTS source_language TEXT DEFAULT 'auto',
  ADD COLUMN IF NOT EXISTS output_language  TEXT DEFAULT 'en';

-- Auto-join toggle for regular users
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS auto_join_all BOOLEAN DEFAULT false;

-- Per-event recording intents (from Google Calendar events)
CREATE TABLE IF NOT EXISTS calendar_meeting_intents (
  id                UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id           UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  calendar_event_id TEXT        NOT NULL,
  meeting_url       TEXT        NOT NULL,
  scheduled_start   TIMESTAMPTZ,
  should_record     BOOLEAN     DEFAULT true,
  bot_launched      BOOLEAN     DEFAULT false,
  meeting_id        UUID        REFERENCES meetings(id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, calendar_event_id)
);

CREATE INDEX IF NOT EXISTS idx_intents_user_id ON calendar_meeting_intents(user_id);

-- ── Sprint 3 additions ─────────────────────────────────────────────────────────

-- Speaker diarization column for transcript segments
ALTER TABLE transcripts ADD COLUMN IF NOT EXISTS speaker TEXT;

-- ── Sprint 4 additions ─────────────────────────────────────────────────────────

-- Structured wrong→correct pair for Sarvam AI training data
ALTER TABLE flags
  ADD COLUMN IF NOT EXISTS suggested_correction TEXT;

-- Prevent same user flagging same segment more than once (atomic, race-safe)
CREATE UNIQUE INDEX IF NOT EXISTS idx_flags_unique_user_segment
  ON flags (transcript_id, user_id);

-- ── Sprint 5 additions — Chrome Extension (primary recorder) ───────────────────

-- Extension auth tokens (long-lived, token-based auth for the Chrome extension)
CREATE TABLE IF NOT EXISTS extension_tokens (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash   TEXT NOT NULL UNIQUE,   -- SHA-256 of raw token; raw token is never stored
  name         TEXT DEFAULT 'Chrome Extension',
  expires_at   TIMESTAMPTZ NOT NULL,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  last_used_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_ext_tokens_user ON extension_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_ext_tokens_hash ON extension_tokens(token_hash);

-- Track how a meeting was recorded (bot vs extension vs manual upload)
ALTER TABLE meetings
  ADD COLUMN IF NOT EXISTS recorder_type TEXT DEFAULT 'bot'
    CHECK (recorder_type IN ('bot', 'extension', 'upload'));

-- ── Sprint 6 additions — Persistent audio + password reset ──────────────────

-- Store audio buffer directly in DB so it survives Railway deploys/restarts
-- and Recall.ai presigned URL expiry (~7 days)
ALTER TABLE meetings ADD COLUMN IF NOT EXISTS audio_data BYTEA;

-- Password reset tokens (1hr expiry, single-use, SHA-256 hashed)
CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash  TEXT NOT NULL UNIQUE,
  expires_at  TIMESTAMPTZ NOT NULL,
  used        BOOLEAN DEFAULT false,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_prt_token_hash ON password_reset_tokens(token_hash);
