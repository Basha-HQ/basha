import { auth } from '@/lib/auth/config';
import { query } from '@/lib/db';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { MeetingCard } from '@/components/meetings/MeetingCard';
import { UpcomingMeetingsWidget } from '@/components/dashboard/UpcomingMeetingsWidget';

interface Meeting {
  id: string;
  title: string;
  platform: string;
  status: string;
  created_at: string;
  duration: number | null;
}

export const metadata = { title: 'Dashboard — Basha' };

export default async function DashboardPage() {
  const session = await auth();
  const userId = session!.user.id;

  const recentMeetings = await query<Meeting>(
    `SELECT id, title, platform, status, created_at, duration
     FROM meetings
     WHERE user_id = $1
     ORDER BY created_at DESC
     LIMIT 5`,
    [userId]
  );

  const [stats] = await query<{ total: string; completed: string; processing: string }>(
    `SELECT
       COUNT(*) AS total,
       COUNT(*) FILTER (WHERE status = 'completed') AS completed,
       COUNT(*) FILTER (WHERE status = 'processing') AS processing
     FROM meetings WHERE user_id = $1`,
    [userId]
  );

  return (
    <div className="px-8 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-500 mt-1">Your meeting notes at a glance</p>
        </div>
        <Link href="/new-meeting">
          <Button size="lg">
            + Start Notetaker
          </Button>
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        {[
          { label: 'Total meetings', value: stats?.total ?? '0' },
          { label: 'Completed', value: stats?.completed ?? '0' },
          { label: 'Processing', value: stats?.processing ?? '0' },
        ].map((s) => (
          <div key={s.label} className="bg-white rounded-xl border border-gray-200 p-5">
            <p className="text-3xl font-bold text-gray-900">{s.value}</p>
            <p className="text-sm text-gray-500 mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent meetings */}
        <div className="lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Recent meetings</h2>
            <Link href="/meetings" className="text-sm text-indigo-600 hover:underline">
              View all
            </Link>
          </div>

          {recentMeetings.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-200 border-dashed p-12 text-center">
              <p className="text-4xl mb-3">🎙️</p>
              <p className="font-medium text-gray-900 mb-1">No meetings yet</p>
              <p className="text-gray-500 text-sm mb-6">
                Start a notetaker to record and transcribe your first meeting
              </p>
              <Link href="/new-meeting">
                <Button>Start Notetaker</Button>
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {recentMeetings.map((m) => (
                <MeetingCard key={m.id} meeting={m} />
              ))}
            </div>
          )}
        </div>

        {/* Upcoming meetings (Google Calendar) */}
        <div>
          <UpcomingMeetingsWidget />
        </div>
      </div>
    </div>
  );
}
