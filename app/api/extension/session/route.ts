/**
 * POST /api/extension/session
 * Creates a meeting record when the Chrome extension starts recording.
 * Auth: Extension Bearer token.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getExtensionUser } from '@/lib/extension/auth';
import { query, queryOne } from '@/lib/db';

function detectPlatform(url: string): 'google_meet' | 'zoom' | 'other' {
  if (url.includes('meet.google.com')) return 'google_meet';
  if (url.includes('zoom.us')) return 'zoom';
  return 'other';
}

export async function POST(req: NextRequest) {
  const userId = await getExtensionUser(req.headers.get('authorization'));
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const {
    sourceLanguage: bodySourceLanguage = 'auto',
    meetingUrl = '',
    title,
    participantNames = [],
    startedAt,
  } = body as {
    sourceLanguage?: string;
    meetingUrl?: string;
    title?: string;
    participantNames?: string[];
    startedAt?: string;
  };

  // Validate client-provided timestamp — accept only reasonable values (within last hour)
  const clientTime = startedAt ? new Date(startedAt) : null;
  const validClientTime =
    clientTime && !isNaN(clientTime.getTime()) &&
    Math.abs(Date.now() - clientTime.getTime()) < 3_600_000
      ? clientTime
      : null;

  // If extension didn't send a language, fall back to the user's settings preference
  let sourceLanguage = bodySourceLanguage;
  if (sourceLanguage === 'auto') {
    const userRow = await queryOne<{ speaking_language: string }>(
      'SELECT speaking_language FROM users WHERE id = $1',
      [userId]
    ).catch(() => null);
    if (userRow?.speaking_language && userRow.speaking_language !== 'auto') {
      sourceLanguage = userRow.speaking_language;
    }
  }

  const platform = detectPlatform(meetingUrl);
  const referenceTime = validClientTime ?? new Date();
  const meetingTitle =
    title ||
    `Meeting · ${referenceTime.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      timeZone: 'Asia/Kolkata',
    })}`;

  // Build initial speaker_labels from DOM-scraped names.
  // SPEAKER_00 → first name, SPEAKER_01 → second name, etc.
  // Sarvam diarization assigns IDs in order of first utterance, which roughly
  // matches join order — this gives users a good starting point to correct if needed.
  const initialSpeakerLabels =
    participantNames.length > 0
      ? Object.fromEntries(
          participantNames
            .slice(0, 10) // cap at 10 speakers
            .map((name, i) => [`SPEAKER_${String(i).padStart(2, '0')}`, name])
        )
      : null;

  const rows = await query<{ id: string }>(
    `INSERT INTO meetings
       (user_id, meeting_link, platform, title, status, source_language, recorder_type, speaker_labels, created_at)
     VALUES ($1, $2, $3, $4, 'recording', $5, 'extension', $6, $7)
     RETURNING id`,
    [userId, meetingUrl || null, platform, meetingTitle, sourceLanguage,
     initialSpeakerLabels ? JSON.stringify(initialSpeakerLabels) : null,
     validClientTime ?? new Date()]
  );

  const meetingId = rows[0].id;

  return NextResponse.json({ meetingId });
}

/**
 * PATCH /api/extension/session
 * Updates speaker_labels on an active meeting from the extension.
 * Called after a delayed re-scrape of participant names from the meeting DOM.
 */
export async function PATCH(req: NextRequest) {
  const userId = await getExtensionUser(req.headers.get('authorization'));
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const { meetingId, participantNames, activeSpeakerTimeline } = body as {
    meetingId?: string;
    participantNames?: string[];
    activeSpeakerTimeline?: { name: string; timestampMs: number }[];
  };

  if (!meetingId) {
    return NextResponse.json({ error: 'meetingId required' }, { status: 400 });
  }

  // Build updates dynamically — both fields are optional
  const setClauses: string[] = [];
  const values: unknown[] = [];
  let paramIdx = 1;

  if (Array.isArray(participantNames) && participantNames.length > 0) {
    const speakerLabels = Object.fromEntries(
      participantNames
        .slice(0, 10)
        .map((name, i) => [`SPEAKER_${String(i).padStart(2, '0')}`, name])
    );
    setClauses.push(`speaker_labels = $${paramIdx++}`);
    values.push(JSON.stringify(speakerLabels));
  }

  if (Array.isArray(activeSpeakerTimeline) && activeSpeakerTimeline.length > 0) {
    setClauses.push(`active_speaker_timeline = $${paramIdx++}`);
    values.push(JSON.stringify(activeSpeakerTimeline));
  }

  if (setClauses.length === 0) {
    return NextResponse.json({ ok: true }); // nothing to update
  }

  values.push(meetingId, userId);
  await query(
    `UPDATE meetings SET ${setClauses.join(', ')} WHERE id = $${paramIdx++} AND user_id = $${paramIdx}`,
    values
  );

  return NextResponse.json({ ok: true });
}
