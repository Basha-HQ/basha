'use client';

interface Summary {
  overview?: string;
  topics: string[];
  decisions: string[];
  notes: string[];
}

const sections = [
  {
    key: 'topics' as const,
    label: 'Topics discussed',
    accent: '#6366f1',
    accentBg: 'rgba(99,102,241,0.1)',
    accentBorder: 'rgba(99,102,241,0.2)',
    dotColor: 'rgba(99,102,241,0.7)',
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
      </svg>
    ),
  },
  {
    key: 'decisions' as const,
    label: 'Key decisions',
    accent: '#34d399',
    accentBg: 'rgba(52,211,153,0.08)',
    accentBorder: 'rgba(52,211,153,0.2)',
    dotColor: 'rgba(52,211,153,0.7)',
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="20 6 9 17 4 12"/>
      </svg>
    ),
  },
  {
    key: 'notes' as const,
    label: 'Action items',
    accent: '#f59e0b',
    accentBg: 'rgba(245,158,11,0.08)',
    accentBorder: 'rgba(245,158,11,0.2)',
    dotColor: 'rgba(245,158,11,0.7)',
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/>
        <line x1="8" y1="18" x2="21" y2="18"/>
        <line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/>
        <line x1="3" y1="18" x2="3.01" y2="18"/>
      </svg>
    ),
  },
];

function buildWhatsAppText(title: string | undefined, summary: Summary): string {
  const lines: string[] = [];
  if (title) lines.push(`*${title}*`, '');
  if (summary.overview) lines.push(summary.overview, '');
  if (summary.notes?.length) {
    lines.push('*Action items:*');
    summary.notes.forEach((n) => lines.push(`• ${n}`));
    lines.push('');
  }
  if (summary.decisions?.length) {
    lines.push('*Key decisions:*');
    summary.decisions.forEach((d) => lines.push(`• ${d}`));
    lines.push('');
  }
  lines.push('_Shared via Basha — trybasha.in_');
  return lines.join('\n');
}

export function MeetingSummaryCard({
  summary,
  duration,
  meetingTitle,
}: {
  summary: Summary;
  duration?: number | null;
  meetingTitle?: string;
}) {
  const activeSections = sections.filter((s) => summary[s.key]?.length > 0);
  if (activeSections.length === 0 && !summary.overview && !duration) return null;

  function handleWhatsApp() {
    const text = buildWhatsAppText(meetingTitle, summary);
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  }

  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}
    >
      {/* Header */}
      <div
        className="px-6 py-4 flex items-center justify-between gap-2.5"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}
      >
        <div className="flex items-center gap-2.5">
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
            style={{ background: 'rgba(99,102,241,0.15)', color: '#6366f1' }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
              <line x1="16" y1="13" x2="8" y2="13"/>
              <line x1="16" y1="17" x2="8" y2="17"/>
              <polyline points="10 9 9 9 8 9"/>
            </svg>
          </div>
          <h2 className="font-semibold text-sm" style={{ color: 'rgba(255,255,255,0.9)' }}>
            Meeting Summary
          </h2>
        </div>

        {/* WhatsApp share */}
        <button
          onClick={handleWhatsApp}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer"
          style={{ background: 'rgba(37,211,102,0.1)', border: '1px solid rgba(37,211,102,0.25)', color: '#25d366' }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'rgba(37,211,102,0.18)'; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'rgba(37,211,102,0.1)'; }}
          title="Share summary on WhatsApp"
        >
          {/* WhatsApp icon */}
          <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z"/>
          </svg>
          Share
        </button>
      </div>

      {/* Overview + duration */}
      {(summary.overview || duration) && (
        <div
          className="px-6 py-4"
          style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}
        >
          {duration && (
            <div className="flex items-center gap-1.5 mb-3">
              <svg
                width="12" height="12" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2"
                strokeLinecap="round" strokeLinejoin="round"
                style={{ color: 'rgba(255,255,255,0.3)' }}
              >
                <circle cx="12" cy="12" r="10"/>
                <polyline points="12 6 12 12 16 14"/>
              </svg>
              <span className="text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>
                {Math.round(duration / 60)} min
              </span>
            </div>
          )}
          {summary.overview && (
            <p className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.65)' }}>
              {summary.overview}
            </p>
          )}
        </div>
      )}

      {/* Content */}
      <div className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {activeSections.map((section) => (
            <div key={section.key}>
              {/* Section header */}
              <div
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg mb-4 text-xs font-semibold"
                style={{
                  color: section.accent,
                  background: section.accentBg,
                  border: `1px solid ${section.accentBorder}`,
                }}
              >
                <span style={{ color: section.accent }}>{section.icon}</span>
                {section.label}
              </div>

              {/* Items */}
              <ul className="space-y-2.5">
                {summary[section.key].map((item, i) => (
                  <li key={i} className="flex items-start gap-2.5 text-sm leading-relaxed">
                    <span
                      className="mt-2 w-1 h-1 rounded-full shrink-0"
                      style={{ background: section.dotColor }}
                    />
                    <span style={{ color: 'rgba(255,255,255,0.75)' }}>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
