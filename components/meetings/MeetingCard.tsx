import Link from 'next/link';
import { Badge, statusToBadgeVariant } from '@/components/ui/Badge';

interface Meeting {
  id: string;
  title: string;
  platform: string;
  status: string;
  created_at: string;
  duration: number | null;
}

function formatDuration(seconds: number | null): string {
  if (!seconds) return '—';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m ${s}s`;
}

function platformLabel(platform: string): string {
  if (platform === 'google_meet') return 'Google Meet';
  if (platform === 'zoom') return 'Zoom';
  return 'Other';
}

export function MeetingCard({ meeting }: { meeting: Meeting }) {
  return (
    <Link href={`/meetings/${meeting.id}`}>
      <div className="bg-white rounded-xl border border-gray-200 p-4 hover:border-indigo-300 hover:shadow-sm transition-all flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-lg bg-indigo-50 flex items-center justify-center text-lg">
            {meeting.platform === 'google_meet' ? '📹' : meeting.platform === 'zoom' ? '💻' : '🎙️'}
          </div>
          <div>
            <p className="font-medium text-gray-900">{meeting.title}</p>
            <p className="text-sm text-gray-400 mt-0.5">
              {platformLabel(meeting.platform)} ·{' '}
              {new Date(meeting.created_at).toLocaleDateString('en-IN', {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
              })}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-400">{formatDuration(meeting.duration)}</span>
          <Badge variant={statusToBadgeVariant(meeting.status)}>
            {meeting.status.charAt(0).toUpperCase() + meeting.status.slice(1)}
          </Badge>
        </div>
      </div>
    </Link>
  );
}
