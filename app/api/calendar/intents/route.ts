import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/config';
import { query, queryOne } from '@/lib/db';

interface Intent {
  id: string;
  calendar_event_id: string;
  meeting_url: string;
  scheduled_start: string | null;
  should_record: boolean;
  bot_launched: boolean;
  meeting_id: string | null;
}

// GET /api/calendar/intents — list all per-event recording intents for the user
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const intents = await query<Intent>(
    `SELECT id, calendar_event_id, meeting_url, scheduled_start, should_record, bot_launched, meeting_id
     FROM calendar_meeting_intents
     WHERE user_id = $1
     ORDER BY scheduled_start ASC NULLS LAST`,
    [session.user.id]
  );

  return NextResponse.json({ intents });
}

// POST /api/calendar/intents — upsert a recording intent for a calendar event
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { calendarEventId, meetingUrl, scheduledStart, shouldRecord } = await req.json();

  if (!calendarEventId || !meetingUrl) {
    return NextResponse.json({ error: 'calendarEventId and meetingUrl are required' }, { status: 400 });
  }

  const intent = await queryOne<Intent>(
    `INSERT INTO calendar_meeting_intents
       (user_id, calendar_event_id, meeting_url, scheduled_start, should_record)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (user_id, calendar_event_id)
     DO UPDATE SET
       meeting_url     = EXCLUDED.meeting_url,
       scheduled_start = EXCLUDED.scheduled_start,
       should_record   = EXCLUDED.should_record
     RETURNING id, calendar_event_id, meeting_url, scheduled_start, should_record, bot_launched, meeting_id`,
    [
      session.user.id,
      calendarEventId,
      meetingUrl,
      scheduledStart ?? null,
      shouldRecord ?? true,
    ]
  );

  return NextResponse.json({ intent }, { status: 201 });
}

// PATCH /api/calendar/intents — mark an intent as bot_launched and link its meeting_id
export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { calendarEventId, botLaunched, meetingId } = await req.json();

  if (!calendarEventId) {
    return NextResponse.json({ error: 'calendarEventId is required' }, { status: 400 });
  }

  const intent = await queryOne<Intent>(
    `UPDATE calendar_meeting_intents
     SET bot_launched = $1, meeting_id = $2
     WHERE user_id = $3 AND calendar_event_id = $4
     RETURNING id, calendar_event_id, meeting_url, scheduled_start, should_record, bot_launched, meeting_id`,
    [botLaunched ?? true, meetingId ?? null, session.user.id, calendarEventId]
  );

  if (!intent) {
    return NextResponse.json({ error: 'Intent not found' }, { status: 404 });
  }

  return NextResponse.json({ intent });
}
