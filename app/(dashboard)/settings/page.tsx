import { SettingsForm } from '@/components/settings/SettingsForm';
import { ExtensionIntegration } from '@/components/settings/ExtensionIntegration';

export const metadata = { title: 'Settings — Basha' };

export default function SettingsPage() {
  return (
    <div
      className="min-h-screen px-4 sm:px-6 lg:px-10 py-8"
      style={{
        background: `
          radial-gradient(ellipse 80% 40% at 50% -10%, rgba(99,102,241,0.1) 0%, transparent 60%),
          #07071a
        `,
      }}
    >
      <div className="max-w-2xl mx-auto space-y-8">
        <div className="mb-8">
          <p className="text-sm font-medium mb-1" style={{ color: '#f59e0b' }}>Preferences</p>
          <h1 className="text-2xl sm:text-3xl font-bold" style={{ color: 'rgba(255,255,255,0.92)' }}>
            Settings
          </h1>
          <p className="text-sm mt-1" style={{ color: 'rgba(255,255,255,0.4)' }}>
            Manage your language preferences, meeting platform, and integrations.
          </p>
        </div>

        <SettingsForm />

        {/* Integrations */}
        <div>
          <p className="text-xs font-bold uppercase tracking-widest mb-4" style={{ color: 'rgba(255,255,255,0.3)' }}>
            Integrations
          </p>
          <ExtensionIntegration />
        </div>
      </div>
    </div>
  );
}
