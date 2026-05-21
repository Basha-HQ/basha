import type { Metadata, Viewport } from 'next';

export const metadata: Metadata = {
  title: 'Basha Bot',
  robots: { index: false, follow: false },
};

export const viewport: Viewport = { width: 1280, height: 720 };

export default function BotOverlayPage() {
  return (
    <>
      <style>{`
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        html, body { width: 1280px; height: 720px; overflow: hidden; }
        .root {
          width: 1280px; height: 720px; background: #0A0A0A; position: relative;
          display: flex; align-items: center; justify-content: center;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
        }
        .center { display: flex; flex-direction: column; align-items: center; gap: 16px; }
        .dot {
          width: 10px; height: 10px; border-radius: 50%; background: #ef4444;
          animation: pulse 2s ease-in-out infinite;
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50%       { opacity: .4; transform: scale(.85); }
        }
        .main { color: rgba(255,255,255,.92); font-size: 28px; font-weight: 500; letter-spacing: -.02em; }
        .sub  { color: rgba(255,255,255,.35); font-size: 14px; letter-spacing: .02em; }
        .wordmark {
          position: absolute; bottom: 28px; left: 32px;
          display: flex; align-items: center; gap: 10px;
        }
        .wicon {
          width: 32px; height: 32px; border-radius: 8px;
          background: linear-gradient(135deg, #f59e0b, #f97316);
          display: flex; align-items: center; justify-content: center;
          font-size: 14px; font-weight: 700; color: #07071a;
        }
        .wtext { font-size: 18px; font-weight: 700; color: rgba(255,255,255,.85); letter-spacing: -.02em; }
        .micoff { position: absolute; top: 28px; right: 32px; opacity: .35; }
      `}</style>

      <div className="root">
        <div className="center">
          <div className="dot" />
          <p className="main">Recording and taking notes</p>
          <p className="sub">Your meeting notes will be ready shortly</p>
        </div>

        <div className="wordmark">
          <div className="wicon">B</div>
          <span className="wtext">Basha</span>
        </div>

        <div className="micoff">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none"
               stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="1" y1="1" x2="23" y2="23" />
            <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6" />
            <path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23" />
            <line x1="12" y1="19" x2="12" y2="23" />
            <line x1="8" y1="23" x2="16" y2="23" />
          </svg>
        </div>
      </div>
    </>
  );
}
