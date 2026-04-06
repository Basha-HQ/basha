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
  summary: string | null;
}

interface Props {
  meetings: Meeting[];
}

type FilterTab = 'all' | 'completed' | 'processing' | 'recording' | 'failed';

const TABS: { key: FilterTab; label: string; activeColor: string }[] = [
  { key: 'all', label: 'All', activeColor: '#f59e0b' },
  { key: 'completed', label: 'Completed', activeColor: '#34d399' },
  { key: 'processing', label: 'Processing', activeColor: '#818cf8' },
  { key: 'recording', label: 'Recording', activeColor: '#f59e0b' },
  { key: 'failed', label: 'Failed', activeColor: '#fb7185' },
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
  const activeTabConfig = TABS.find((t) => t.key === activeTab)!;

  return (
    <div>
      {/* Search */}
      <div className="relative mb-6">
        <div className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
        </div>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search meetings…"
          className="w-full pl-10 pr-4 py-3 text-sm rounded-xl outline-none transition-all"
          style={{
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.08)',
            color: 'rgba(255,255,255,0.82)',
          }}
          onFocus={(e) => {
            (e.target as HTMLInputElement).style.borderColor = 'rgba(245,158,11,0.35)';
            (e.target as HTMLInputElement).style.background = 'rgba(255,255,255,0.04)';
          }}
          onBlur={(e) => {
            (e.target as HTMLInputElement).style.borderColor = 'rgba(255,255,255,0.08)';
            (e.target as HTMLInputElement).style.background = 'rgba(255,255,255,0.03)';
          }}
        />
        {search && (
          <button
            onClick={() => setSearch('')}
            className="absolute right-4 top-1/2 -translate-y-1/2 transition-opacity hover:opacity-70"
            style={{ color: 'rgba(255,255,255,0.3)' }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        )}
      </div>

      {/* Underline tabs */}
      <div
        className="flex items-center gap-0 mb-6 overflow-x-auto"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}
      >
        {visibleTabs.map((tab) => {
          const count = counts[tab.key] ?? 0;
          const active = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-all whitespace-nowrap relative"
              style={{
                color: active ? tab.activeColor : 'rgba(255,255,255,0.35)',
                borderBottom: active ? `2px solid ${tab.activeColor}` : '2px solid transparent',
                marginBottom: '-1px',
              }}
              onMouseEnter={(e) => {
                if (!active) (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.65)';
              }}
              onMouseLeave={(e) => {
                if (!active) (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.35)';
              }}
            >
              {tab.label}
              <span
                className="text-[11px] font-semibold px-1.5 py-0.5 rounded"
                style={{
                  background: active ? `${tab.activeColor}18` : 'rgba(255,255,255,0.06)',
                  color: active ? tab.activeColor : 'rgba(255,255,255,0.3)',
                }}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Results */}
      {filtered.length === 0 ? (
        <div
          className="rounded-xl py-16 text-center"
          style={{ background: 'rgba(255,255,255,0.02)', border: '1px dashed rgba(255,255,255,0.07)' }}
        >
          <p className="text-2xl mb-3">🔍</p>
          <p className="font-semibold text-sm mb-1" style={{ color: 'rgba(255,255,255,0.65)' }}>No meetings found</p>
          <p className="text-xs font-light" style={{ color: 'rgba(255,255,255,0.28)' }}>
            {search ? `No results for "${search}"` : `No ${activeTab} meetings yet`}
          </p>
        </div>
      ) : (
        <div className="space-y-1.5">
          {filtered.map((m) => (
            <MeetingCard key={m.id} meeting={m} />
          ))}
        </div>
      )}
    </div>
  );
}
