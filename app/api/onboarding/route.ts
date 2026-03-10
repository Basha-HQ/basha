import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/config';
import { query } from '@/lib/db';

export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { preferred_languages, output_language, meeting_platform } = await req.json();

  await query(
    `UPDATE users
     SET preferred_languages  = $1,
         output_language      = $2,
         meeting_platform     = $3,
         onboarding_completed = true
     WHERE id = $4`,
    [
      preferred_languages ?? [],
      output_language ?? 'en',
      meeting_platform ?? 'both',
      session.user.id,
    ]
  );

  return NextResponse.json({ success: true });
}
