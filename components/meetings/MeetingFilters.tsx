'use client';

import { useState, useMemo } from 'react';
import { MeetingCard } from './MeetingCard';

interface Meeting {
  id: string;
  title: string;
  platform: string;
  status: string;
  created_at: string;
  duration: number | null;
  source_language: string | null;
}

interface Props {
  meetings: Meeting[];
}

type FilterTab = 'all' | 'completed' | 'processing' | 'recording' | 'failed';

const TABS: { key: FilterTab; label: string; activeColor: string; activeBg: string; activeBorder: string }[] = [
  { key: 'all', label: 'All', activeColor: '#f59e0b', activeBg: 'rgba(245,158,11,0.1)', activeBorder: 'rgba(245,158,11,0.25)' },
  { key: 'completed', label: 'Completed', activeColor: '#34d399', activeBg: 'rgba(52,211,153,0.1)', activeBorder: 'rgba(52,211,153,0.25)' },
  { key: 'processing', label: 'Processing', activeColor: '#6366f1', activeBg: 'rgba(99,102,241,0.12)', activeBorder: 'rgba(99,102,241,0.25)' },
  { key: 'recording', label: 'Recording', activeColor: '#f59e0b', activeBg: 'rgba(245,158,11,0.1)', activeBorder: 'rgba(245,158,11,0.25)' },
  { key: 'failed', label: 'Failed', activeColor: '#fb7185', activeBg: 'rgba(251,113,133,0.1)', activeBorder: 'rgba(251,113,133,0.25)' },
];

export function MeetingFilters({ meetings }: Props) {
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<FilterTab>('all');

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: meetings.length };
    for (const m of meetings) {
      c[m.status] = (c[m.status] ?? 0) + 1;
    }
    return c;
  }, [meetings]);

  const filtered = useMemo(() => {
    let result = meetings;
    if (activeTab !== 'all') result = result.filter((m) => m.status === activeTab);
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter((m) => m.title.toLowerCase().includes(q));
    }
    return result;
  }, [meetings, activeTab, search]);

  const visibleTabs = TABS.filter((t) => t.key === 'all' || (counts[t.key] ?? 0) > 0);

  return (
    <div>
      {/* Search + filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        {/* Search */}
        <div className="relative flex-1">
          <div className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          </div>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search meetings…"
            className="w-full pl-9 pr-4 py-2.5 text-sm rounded-xl outline-none transition-all"
            style={{
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.1)',
              color: 'rgba(255,255,255,0.85)',
            }}
            onFocus={(e) => { (e.target as HTMLInputElement).style.borderColor = 'rgba(245,158,11,0.4)'; (e.target as HTMLInputElement).style.boxShadow = '0 0 0 3px rgba(245,158,11,0.08)'; }}
            onBlur={(e) => { (e.target as HTMLInputElement).style.borderColor = 'rgba(255,255,255,0.1)'; (e.target as HTMLInputElement).style.boxShadow = 'none'; }}
          />
        </div>

        {/* Filter tabs */}
        <div
          className="flex gap-1 p-1 rounded-xl overflow-x-auto flex-shrink-0"
          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}
        >
          {visibleTabs.map((tab) => {
            const count = counts[tab.key] ?? 0;
            const active = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap"
                style={{
                  background: active ? tab.activeBg : 'transparent',
                  color: active ? tab.activeColor : 'rgba(255,255,255,0.45)',
                  border: active ? `1px solid ${tab.activeBorder}` : '1px solid transparent',
                }}
              >
                {tab.label}
                <span
                  className="inline-flex items-center justify-center w-4 h-4 rounded-full text-[10px] font-bold"
                  style={{
                    background: active ? tab.activeBg : 'rgba(255,255,255,0.08)',
                    color: active ? tab.activeColor : 'rgba(255,255,255,0.35)',
                    border: active ? `1px solid ${tab.activeBorder}` : '1px solid transparent',
                  }}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Results */}
      {filtered.length === 0 ? (
        <div
          className="rounded-2xl p-16 text-center"
          style={{ background: 'rgba(255,255,255,0.02)', border: '1px dashed rgba(255,255,255,0.08)' }}
        >
          <p className="text-3xl mb-3">🔍</p>
          <p className="font-semibold mb-1" style={{ color: 'rgba(255,255,255,0.7)' }}>No meetings found</p>
          <p className="text-sm" style={{ color: 'rgba(255,255,255,0.3)' }}>
            {search ? `No results for "${search}"` : `No ${activeTab} meetings yet`}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((m) => (
            <MeetingCard key={m.id} meeting={m} />
          ))}
        </div>
      )}
    </div>
  );
}
