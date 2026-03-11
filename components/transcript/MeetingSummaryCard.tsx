interface Summary {
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

export function MeetingSummaryCard({ summary }: { summary: Summary }) {
  const activeSections = sections.filter((s) => summary[s.key]?.length > 0);
  if (activeSections.length === 0) return null;

  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}
    >
      {/* Header */}
      <div
        className="px-6 py-4 flex items-center gap-2.5"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}
      >
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
