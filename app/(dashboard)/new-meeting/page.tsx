import { NewMeetingForm } from '@/components/meetings/NewMeetingForm';

export const metadata = { title: 'Record Meeting — Basha' };

const HOW_IT_WORKS_EXTENSION = [
  {
    icon: '🔌',
    title: 'Install the Basha extension',
    desc: 'One-time Chrome install. No bot invites. No meeting link needed.',
    color: '#6366f1',
    colorBg: 'rgba(99,102,241,0.12)',
    colorBorder: 'rgba(99,102,241,0.2)',
  },
  {
    icon: '🎙',
    title: 'Hit Record when meeting starts',
    desc: 'Click the Basha icon in Chrome. Nothing joins your call — invisible to all participants.',
    color: '#f59e0b',
    colorBg: 'rgba(245,158,11,0.1)',
    colorBorder: 'rgba(245,158,11,0.2)',
  },
  {
    icon: '📝',
    title: 'Get your transcript',
    desc: 'Basha transcribes your Hinglish, Tanglish, or Tamil in the original language — plus a clean English version.',
    color: '#34d399',
    colorBg: 'rgba(52,211,153,0.1)',
    colorBorder: 'rgba(52,211,153,0.2)',
  },
];


export default function NewMeetingPage() {
  return (
    <div
      className="min-h-screen px-4 sm:px-6 lg:px-10 py-8"
      style={{
        background: `
          radial-gradient(ellipse 80% 40% at 50% -10%, rgba(99,102,241,0.15) 0%, transparent 60%),
          radial-gradient(circle, rgba(99,102,241,0.06) 1px, transparent 1px)
        `,
        backgroundSize: '100% 100%, 36px 36px',
        backgroundColor: '#07071a',
      }}
    >
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="mb-8 animate-fade-up-1">
          <p className="text-sm font-medium mb-1" style={{ color: '#6366f1' }}>AI Notetaker</p>
          <h1 className="text-2xl sm:text-3xl font-bold" style={{ color: 'rgba(255,255,255,0.92)' }}>
            Record your meeting
          </h1>
          <p className="text-sm mt-1" style={{ color: 'rgba(255,255,255,0.4)' }}>
            No bots. No invites. Just click record.
          </p>
        </div>

        {/* Two-column layout */}
        <div className="flex flex-col lg:flex-row gap-6 animate-fade-up-2">
          {/* Form */}
          <div className="flex-1 min-w-0">
            <NewMeetingForm />
          </div>

          {/* How it works — two variants, shown by CSS based on URL hash (JS-free fallback: show extension steps by default) */}
          <div className="lg:w-72 flex-shrink-0 space-y-4">
            {/* Extension steps (default / primary) */}
            <div
              className="rounded-2xl p-5"
              style={{
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.08)',
              }}
            >
              <p className="text-xs font-bold uppercase tracking-widest mb-5" style={{ color: 'rgba(255,255,255,0.35)' }}>
                Extension — how it works
              </p>
              <div className="space-y-5">
                {HOW_IT_WORKS_EXTENSION.map((item, i) => (
                  <div key={i} className="flex gap-3.5">
                    <div
                      className="w-9 h-9 rounded-xl flex items-center justify-center text-lg flex-shrink-0"
                      style={{ background: item.colorBg, border: `1px solid ${item.colorBorder}` }}
                    >
                      {item.icon}
                    </div>
                    <div className="pt-0.5">
                      <p className="text-sm font-semibold" style={{ color: 'rgba(255,255,255,0.85)' }}>{item.title}</p>
                      <p className="text-xs mt-0.5 leading-relaxed" style={{ color: 'rgba(255,255,255,0.35)' }}>{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-5 pt-4" style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }}>
                <p className="text-xs leading-relaxed" style={{ color: 'rgba(255,255,255,0.3)' }}>
                  Supports Google Meet, Zoom, and Microsoft Teams.
                </p>
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
