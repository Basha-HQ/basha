'use client';

import { useState, useEffect } from 'react';
import ExtensionInstallBanner from './ExtensionInstallBanner';
import ExtensionStatusCard from './ExtensionStatusCard';


type Mode = 'form' | 'extension-status';


/** True if the Basha extension is installed in this browser */
function useExtensionDetected() {
  const [detected, setDetected] = useState<boolean | null>(null);
  useEffect(() => {
    let resolved = false;
    const handler = (event: MessageEvent) => {
      if (event.data?.type === 'BASHA_PONG' && !resolved) {
        resolved = true;
        setDetected(true);
      }
    };
    window.addEventListener('message', handler);
    window.postMessage({ type: 'BASHA_PING' }, '*');
    const t = setTimeout(() => { if (!resolved) setDetected(false); }, 700);
    return () => { window.removeEventListener('message', handler); clearTimeout(t); };
  }, []);
  return detected;
}

export function NewMeetingForm() {
  const [mode, setMode] = useState<Mode>('form');
  const [extensionMeetingId, setExtensionMeetingId] = useState('');
  const extensionDetected = useExtensionDetected();

  // Listen for the extension creating a session (extension sends meetingId via postMessage)
  useEffect(() => {
    const handler = (event: MessageEvent) => {
      if (event.data?.type === 'BASHA_RECORDING_STARTED' && event.data.meetingId) {
        setExtensionMeetingId(event.data.meetingId);
        setMode('extension-status');
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, []);

  // Render status card when active
  if (mode === 'extension-status') {
    return (
      <ExtensionStatusCard
        meetingId={extensionMeetingId}
        onCancel={() => { setMode('form'); setExtensionMeetingId(''); }}
      />
    );
  }

  return (
    <div>
      <div className="rounded-2xl overflow-hidden" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
        <div className="p-5 sm:p-6 space-y-5">
          <div className="space-y-5">
              {/* Extension not yet detected / not installed */}
              {extensionDetected === false && <ExtensionInstallBanner />}

              {/* Extension detected — show ready state */}
              {extensionDetected === true && (
                <>
                  {/* Instruction card */}
                  <div className="px-4 py-3.5 rounded-xl text-sm leading-relaxed space-y-1" style={{ background: 'rgba(99,102,241,0.07)', border: '1px solid rgba(99,102,241,0.15)', color: 'rgba(255,255,255,0.55)' }}>
                    <p className="font-medium" style={{ color: 'rgba(255,255,255,0.75)' }}>
                      How to record with the extension
                    </p>
                    <ol className="text-xs space-y-1 list-decimal list-inside" style={{ color: 'rgba(255,255,255,0.4)' }}>
                      <li>Open your Google Meet, Zoom, or Teams tab</li>
                      <li>Click the <strong style={{ color: 'rgba(255,255,255,0.65)' }}>Basha icon</strong> in your Chrome toolbar</li>
                      <li>Select language and click <strong style={{ color: 'rgba(255,255,255,0.65)' }}>Start Recording</strong></li>
                      <li>Click Stop when your meeting ends — transcript will appear here</li>
                    </ol>
                  </div>

                  <div className="px-4 py-3 rounded-xl text-xs" style={{ background: 'rgba(16,185,129,0.07)', border: '1px solid rgba(16,185,129,0.15)', color: 'rgba(52,211,153,0.8)' }}>
                    ✓ Extension connected · No bot will join your call
                  </div>
                </>
              )}

              {/* Still checking */}
              {extensionDetected === null && (
                <div className="flex items-center justify-center h-20 text-slate-500 text-sm">
                  Checking for Basha extension…
                </div>
              )}
            </div>

        </div>
      </div>
    </div>
  );
}
