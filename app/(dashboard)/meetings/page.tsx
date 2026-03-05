import { auth } from '@/lib/auth/config';
import { query } from '@/lib/db';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { MeetingCard } from '@/components/meetings/MeetingCard';

interface Meeting {
  id: string;
  title: string;
  platform: string;
  status: string;
  created_at: string;
  duration: number | null;
}

export const metadata = { title: 'Meeting History — LinguaMeet' };

export default async function MeetingsPage() {
  const session = await auth();
  const userId = session!.user.id;

  const meetings = await query<Meeting>(
    `SELECT id, title, platform, status, created_at, duration
     FROM meetings
     WHERE user_id = $1
     ORDER BY created_at DESC`,
    [userId]
  );

  return (
    <div className="px-8 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Meeting History</h1>
          <p className="text-gray-500 mt-1">{meetings.length} meeting{meetings.length !== 1 ? 's' : ''} total</p>
        </div>
        <Link href="/new-meeting">
          <Button>+ Start Notetaker</Button>
        </Link>
      </div>

      {meetings.length === 0 ? (
        <div className="bg-white rounded-xl border border-dashed border-gray-300 p-16 text-center">
          <p className="text-4xl mb-4">📋</p>
          <p className="font-medium text-gray-900 mb-2">No meetings yet</p>
          <p className="text-gray-500 text-sm mb-6">
            Your recorded and transcribed meetings will appear here
          </p>
          <Link href="/new-meeting">
            <Button>Start your first meeting</Button>
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {meetings.map((m) => (
            <MeetingCard key={m.id} meeting={m} />
          ))}
        </div>
      )}
    </div>
  );
}
