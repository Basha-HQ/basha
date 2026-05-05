import { ExtensionIntegration } from '@/components/settings/ExtensionIntegration';

export const metadata = { title: 'Settings — Basha' };

export default function SettingsPage() {
  return (
    <div
      className="min-h-screen px-5 sm:px-8 lg:px-10 py-8"
      style={{
        background: `
          radial-gradient(ellipse 60% 25% at 30% -5%, rgba(245,158,11,0.06) 0%, transparent 55%)
        `,
        backgroundColor: '#07071a',
      }}
    >
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="mb-10 animate-fade-up-1">
          <p className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: 'rgba(255,255,255,0.25)' }}>
            Preferences
          </p>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight" style={{ color: 'rgba(255,255,255,0.95)' }}>
            Settings
          </h1>
          <p className="text-sm mt-2 font-light" style={{ color: 'rgba(255,255,255,0.38)' }}>
            Manage your preferences and integrations.
          </p>
        </div>

        <div className="space-y-4">
          <div id="integrations" className="animate-fade-up-2">
            <ExtensionIntegration />
          </div>
        </div>
      </div>
    </div>
  );
}
