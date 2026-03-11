'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut } from 'next-auth/react';
import { ReactNode, useState } from 'react';

interface User {
  id: string;
  name: string;
  email: string;
  image?: string;
  planType?: string;
}

interface Props {
  children: ReactNode;
  user: User;
}

function HomeIcon({ active }: { active?: boolean }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.5 : 2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  );
}

function HistoryIcon({ active }: { active?: boolean }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.5 : 2} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

function MenuIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="3" y1="6" x2="21" y2="6" />
      <line x1="3" y1="12" x2="21" y2="12" />
      <line x1="3" y1="18" x2="21" y2="18" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

function SignOutIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  );
}

const navLinks = [
  { href: '/dashboard', label: 'Dashboard', icon: HomeIcon },
  { href: '/meetings', label: 'Meeting History', icon: HistoryIcon },
];

function SidebarContent({ pathname, user, onClose }: { pathname: string; user: User; onClose?: () => void }) {
  const plan = user.planType ?? 'free';
  const initials = user.name
    ? user.name.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase()
    : 'U';

  return (
    <aside
      className="w-64 flex flex-col h-full"
      style={{
        background: '#0a0a1f',
        borderRight: '1px solid rgba(255,255,255,0.07)',
      }}
    >
      {/* Logo row */}
      <div className="px-5 py-5 flex items-center justify-between" style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
        <Link href="/dashboard" className="flex items-center gap-2.5" onClick={onClose}>
          <div
            className="w-8 h-8 rounded-xl flex items-center justify-center font-bold text-sm flex-shrink-0"
            style={{ background: 'linear-gradient(135deg, #f59e0b, #f97316)', color: '#07071a' }}
          >
            L
          </div>
          <div className="flex flex-col leading-none">
            <span className="font-bold text-sm" style={{ color: 'rgba(255,255,255,0.92)' }}>LinguaMeet</span>
            <span className="text-[10px] font-normal" style={{ color: 'rgba(255,255,255,0.35)' }}>AI Meeting Notes</span>
          </div>
        </Link>
        {onClose && (
          <button onClick={onClose} style={{ color: 'rgba(255,255,255,0.4)' }} className="hover:text-white transition-colors">
            <CloseIcon />
          </button>
        )}
      </div>

      {/* New Meeting CTA */}
      <div className="px-3 pt-4 pb-2">
        <Link
          href="/new-meeting"
          onClick={onClose}
          className="btn-amber-shimmer flex items-center justify-center gap-2 w-full px-4 py-2.5 rounded-xl text-sm font-bold transition-all hover:scale-[1.02] active:scale-[0.98]"
          style={{ color: '#07071a' }}
        >
          <PlusIcon />
          New Meeting
        </Link>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-2 space-y-0.5">
        {navLinks.map((link) => {
          const active = pathname === link.href;
          const Icon = link.icon;
          return (
            <Link
              key={link.href}
              href={link.href}
              onClick={onClose}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all"
              style={{
                background: active ? 'rgba(245,158,11,0.1)' : 'transparent',
                color: active ? '#f59e0b' : 'rgba(255,255,255,0.5)',
                border: active ? '1px solid rgba(245,158,11,0.18)' : '1px solid transparent',
              }}
              onMouseEnter={(e) => {
                if (!active) (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.85)';
                if (!active) (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.04)';
              }}
              onMouseLeave={(e) => {
                if (!active) (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.5)';
                if (!active) (e.currentTarget as HTMLElement).style.background = 'transparent';
              }}
            >
              <span><Icon active={active} /></span>
              {link.label}
            </Link>
          );
        })}
      </nav>

      {/* User profile */}
      <div className="px-3 py-4" style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }}>
        <div
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl mb-2"
          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}
        >
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs flex-shrink-0"
            style={{ background: 'linear-gradient(135deg, #f59e0b, #f97316)', color: '#07071a' }}
          >
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <p className="text-sm font-semibold truncate" style={{ color: 'rgba(255,255,255,0.85)' }}>{user.name}</p>
              <span
                className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide flex-shrink-0"
                style={{
                  background: plan === 'pro' ? 'rgba(245,158,11,0.15)' : 'rgba(255,255,255,0.07)',
                  color: plan === 'pro' ? '#f59e0b' : 'rgba(255,255,255,0.35)',
                }}
              >
                {plan}
              </span>
            </div>
            <p className="text-xs truncate" style={{ color: 'rgba(255,255,255,0.3)' }}>{user.email}</p>
          </div>
        </div>
        <button
          onClick={() => signOut({ callbackUrl: '/' })}
          className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-sm transition-all"
          style={{ color: 'rgba(255,255,255,0.35)' }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.7)'; (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.04)'; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.35)'; (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
        >
          <SignOutIcon />
          Sign out
        </button>
      </div>
    </aside>
  );
}

export function DashboardShell({ children, user }: Props) {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#07071a' }}>
      {/* Mobile top bar */}
      <header
        className="md:hidden flex items-center justify-between px-4 py-3 sticky top-0 z-40"
        style={{
          background: 'rgba(7,7,26,0.92)',
          borderBottom: '1px solid rgba(255,255,255,0.07)',
          backdropFilter: 'blur(12px)',
        }}
      >
        <button
          onClick={() => setSidebarOpen(true)}
          className="p-2 rounded-lg transition-all"
          style={{ color: 'rgba(255,255,255,0.6)' }}
        >
          <MenuIcon />
        </button>
        <Link href="/dashboard" className="flex items-center gap-2">
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs"
            style={{ background: 'linear-gradient(135deg, #f59e0b, #f97316)', color: '#07071a' }}
          >
            L
          </div>
          <span className="font-bold text-sm" style={{ color: 'rgba(255,255,255,0.92)' }}>LinguaMeet</span>
        </Link>
        <Link
          href="/new-meeting"
          className="px-3 py-1.5 rounded-lg text-xs font-bold"
          style={{ background: 'rgba(245,158,11,0.15)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.25)' }}
        >
          + New
        </Link>
      </header>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <div className="flex-1 bg-black/70" onClick={() => setSidebarOpen(false)} />
          <div className="flex-shrink-0">
            <SidebarContent pathname={pathname} user={user} onClose={() => setSidebarOpen(false)} />
          </div>
        </div>
      )}

      {/* Desktop layout */}
      <div className="hidden md:flex flex-1">
        <div className="fixed h-full z-10">
          <SidebarContent pathname={pathname} user={user} />
        </div>
        <main className="flex-1 ml-64 min-h-screen">
          {children}
        </main>
      </div>

      {/* Mobile main content */}
      <main className="md:hidden flex-1">
        {children}
      </main>
    </div>
  );
}
