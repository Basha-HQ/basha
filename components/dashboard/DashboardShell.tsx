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
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.5 : 2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  );
}

function HistoryIcon({ active }: { active?: boolean }) {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.5 : 2} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
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

function SettingsIcon({ active }: { active?: boolean }) {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.5 : 2} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}

function SignOutIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  );
}

const navLinks = [
  { href: '/dashboard', label: 'Dashboard', icon: HomeIcon },
  { href: '/meetings', label: 'Meeting History', icon: HistoryIcon },
  { href: '/settings', label: 'Settings', icon: SettingsIcon },
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
        borderRight: '1px solid rgba(255,255,255,0.06)',
      }}
    >
      {/* Logo */}
      <div className="px-5 pt-6 pb-5 flex items-center justify-between">
        <Link href="/dashboard" className="flex items-center gap-3" onClick={onClose}>
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm flex-shrink-0"
            style={{ background: 'linear-gradient(135deg, #f59e0b, #f97316)', color: '#07071a' }}
          >
            B
          </div>
          <div className="flex flex-col leading-none gap-0.5">
            <span className="font-bold text-[15px] tracking-tight" style={{ color: 'rgba(255,255,255,0.95)' }}>Basha</span>
            <span className="text-[10px] font-light tracking-wider uppercase" style={{ color: 'rgba(255,255,255,0.3)' }}>AI Notes</span>
          </div>
        </Link>
        {onClose && (
          <button onClick={onClose} className="p-1 rounded-md transition-colors" style={{ color: 'rgba(255,255,255,0.3)' }}>
            <CloseIcon />
          </button>
        )}
      </div>

      {/* New Meeting CTA */}
      <div className="px-4 pb-5">
        <Link
          href="/new-meeting"
          onClick={onClose}
          className="btn-amber-shimmer flex items-center justify-center gap-2 w-full px-4 py-2.5 rounded-lg text-sm font-semibold transition-all hover:opacity-90 active:scale-[0.98]"
          style={{ color: '#07071a' }}
        >
          <PlusIcon />
          Start Notetaker
        </Link>
      </div>

      {/* Divider */}
      <div className="mx-4 mb-3" style={{ height: '1px', background: 'rgba(255,255,255,0.05)' }} />

      {/* Nav */}
      <nav className="flex-1 px-2 space-y-0.5">
        <p className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.2)' }}>
          Navigation
        </p>
        {navLinks.map((link) => {
          const active = pathname === link.href;
          const Icon = link.icon;
          return (
            <Link
              key={link.href}
              href={link.href}
              onClick={onClose}
              className="flex items-center gap-3 py-2.5 text-sm font-medium transition-colors relative"
              style={{
                paddingLeft: active ? 'calc(0.75rem - 3px)' : '0.75rem',
                paddingRight: '0.75rem',
                color: active ? '#f59e0b' : 'rgba(255,255,255,0.45)',
                borderLeft: active ? '3px solid #f59e0b' : '3px solid transparent',
                borderRadius: '0 8px 8px 0',
                background: active ? 'rgba(245,158,11,0.07)' : 'transparent',
              }}
              onMouseEnter={(e) => {
                if (!active) {
                  (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.82)';
                  (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.04)';
                }
              }}
              onMouseLeave={(e) => {
                if (!active) {
                  (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.45)';
                  (e.currentTarget as HTMLElement).style.background = 'transparent';
                }
              }}
            >
              <span style={{ flexShrink: 0 }}><Icon active={active} /></span>
              {link.label}
            </Link>
          );
        })}
      </nav>

      {/* User profile */}
      <div className="px-4 py-4" style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
        <div className="flex items-center gap-3 mb-3">
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs flex-shrink-0"
            style={{ background: 'linear-gradient(135deg, #f59e0b, #f97316)', color: '#07071a' }}
          >
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className="text-sm font-semibold truncate" style={{ color: 'rgba(255,255,255,0.88)' }}>{user.name}</p>
              <span
                className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider flex-shrink-0"
                style={{
                  background: plan === 'pro' ? 'rgba(245,158,11,0.15)' : 'rgba(255,255,255,0.06)',
                  color: plan === 'pro' ? '#f59e0b' : 'rgba(255,255,255,0.3)',
                  border: plan === 'pro' ? '1px solid rgba(245,158,11,0.2)' : '1px solid rgba(255,255,255,0.08)',
                }}
              >
                {plan}
              </span>
            </div>
            <p className="text-xs truncate mt-0.5" style={{ color: 'rgba(255,255,255,0.28)' }}>{user.email}</p>
          </div>
        </div>
        <button
          onClick={() => signOut({ callbackUrl: '/' })}
          className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-xs font-medium transition-all"
          style={{ color: 'rgba(255,255,255,0.28)' }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.65)';
            (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.04)';
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.28)';
            (e.currentTarget as HTMLElement).style.background = 'transparent';
          }}
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
          background: 'rgba(10,10,31,0.95)',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          backdropFilter: 'blur(12px)',
        }}
      >
        <button
          onClick={() => setSidebarOpen(true)}
          className="p-2 rounded-lg transition-colors"
          style={{ color: 'rgba(255,255,255,0.5)' }}
        >
          <MenuIcon />
        </button>
        <Link href="/dashboard" className="flex items-center gap-2">
          <div
            className="w-7 h-7 rounded-md flex items-center justify-center font-bold text-xs"
            style={{ background: 'linear-gradient(135deg, #f59e0b, #f97316)', color: '#07071a' }}
          >
            B
          </div>
          <span className="font-bold text-sm tracking-tight" style={{ color: 'rgba(255,255,255,0.92)' }}>Basha</span>
        </Link>
        <Link
          href="/new-meeting"
          className="px-3 py-1.5 rounded-lg text-xs font-semibold"
          style={{ background: 'rgba(245,158,11,0.12)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.22)' }}
        >
          Record
        </Link>
      </header>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setSidebarOpen(false)} />
          <div className="relative z-10 flex-shrink-0">
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
