/**
 * Basha Chrome Extension — Meeting page content script (content-script.js)
 *
 * Injected into: Google Meet, Zoom web, Microsoft Teams
 *
 * Responsibilities:
 *  1. Inject a floating "Basha recording" pill when recording is active
 *  2. Show a subtle toast prompting the user to start recording when in a meeting
 *  3. Auto-stop recording when the user leaves the meeting (call-ended detection)
 *  4. Scrape participant names from Google Meet DOM
 */

const INDICATOR_ID = 'basha-rec-indicator';
const TOAST_ID = 'basha-start-toast';

// ---------------------------------------------------------------------------
// Participant name scraping (Google Meet)
// ---------------------------------------------------------------------------

const EXCLUDE_NAMES = new Set([
  'you', 'muted', 'unmuted', 'pin', 'more', 'options', 'remove',
  'message', 'spotlight', 'tile', 'participant', 'host',
]);

function scrapeParticipants() {
  const names = new Set();
  const selectors = ['.zWfAib', '.KF4T6b', '.cS7aqe', '.YTbUzc', '.dwSJ2e'];
  for (const sel of selectors) {
    document.querySelectorAll(sel).forEach((el) => {
      const text = el.textContent?.trim() ?? '';
      if (text.length >= 2 && text.length <= 80 && !EXCLUDE_NAMES.has(text.toLowerCase())) {
        names.add(text);
      }
    });
  }
  document.querySelectorAll('[data-participant-id]').forEach((tile) => {
    for (const span of tile.querySelectorAll('span, div')) {
      const text = span.textContent?.trim() ?? '';
      if (text.length >= 2 && text.length <= 60 && !EXCLUDE_NAMES.has(text.toLowerCase()) && span.children.length === 0) {
        names.add(text);
        break;
      }
    }
  });
  return [...names];
}

// ---------------------------------------------------------------------------
// Recording indicator pill
// ---------------------------------------------------------------------------

function createIndicator() {
  if (document.getElementById(INDICATOR_ID)) return;
  const style = document.createElement('style');
  style.textContent = `
    #${INDICATOR_ID} {
      position: fixed; bottom: 80px; left: 50%;
      transform: translateX(-50%);
      z-index: 99999; pointer-events: none;
    }
    #${INDICATOR_ID} span {
      display: inline-flex; align-items: center; gap: 6px;
      background: rgba(13,15,26,0.92); border: 1px solid #ef4444;
      border-radius: 20px; padding: 5px 12px;
      font-size: 12px; font-weight: 600; color: #fca5a5;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    }
    #${INDICATOR_ID} .dot {
      width: 7px; height: 7px; background: #ef4444; border-radius: 50%;
      animation: basha-pulse 1.2s infinite;
    }
    @keyframes basha-pulse { 0%,100%{opacity:1} 50%{opacity:0.3} }
  `;
  document.head.appendChild(style);

  const el = document.createElement('div');
  el.id = INDICATOR_ID;
  el.innerHTML = `<span><span class="dot"></span>Basha recording</span>`;
  document.body.appendChild(el);
}

function removeIndicator() {
  document.getElementById(INDICATOR_ID)?.remove();
}

// ---------------------------------------------------------------------------
// Start-recording prompt toast
// ---------------------------------------------------------------------------

function showStartToast() {
  if (document.getElementById(TOAST_ID)) return;

  const style = document.createElement('style');
  style.id = TOAST_ID + '-style';
  style.textContent = `
    #${TOAST_ID} {
      position: fixed; bottom: 24px; left: 50%;
      transform: translateX(-50%) translateY(0);
      z-index: 99999;
      display: flex; align-items: center; gap: 10px;
      background: rgba(13,15,26,0.97);
      border: 1px solid rgba(245,158,11,0.4);
      border-radius: 24px; padding: 8px 16px 8px 10px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      font-size: 12px; font-weight: 500; color: #e2e8f0;
      box-shadow: 0 4px 24px rgba(0,0,0,0.5);
      animation: basha-toast-in 0.3s ease-out, basha-toast-out 0.4s ease-in 5s forwards;
      white-space: nowrap;
    }
    #${TOAST_ID} .b-logo {
      width: 22px; height: 22px; border-radius: 6px;
      background: linear-gradient(135deg, #f59e0b, #f97316);
      display: flex; align-items: center; justify-content: center;
      font-weight: 800; font-size: 11px; color: #07071a; flex-shrink: 0;
    }
    @keyframes basha-toast-in {
      from { opacity: 0; transform: translateX(-50%) translateY(10px); }
      to   { opacity: 1; transform: translateX(-50%) translateY(0); }
    }
    @keyframes basha-toast-out {
      from { opacity: 1; transform: translateX(-50%) translateY(0); }
      to   { opacity: 0; transform: translateX(-50%) translateY(10px); pointer-events: none; }
    }
  `;
  document.head.appendChild(style);

  const el = document.createElement('div');
  el.id = TOAST_ID;
  el.innerHTML = `
    <div class="b-logo">B</div>
    <span>Click <strong>Basha</strong> in your toolbar to start recording</span>
  `;
  document.body.appendChild(el);

  // Remove after animation completes
  setTimeout(() => {
    document.getElementById(TOAST_ID)?.remove();
    document.getElementById(TOAST_ID + '-style')?.remove();
  }, 5500);
}

function removeStartToast() {
  document.getElementById(TOAST_ID)?.remove();
  document.getElementById(TOAST_ID + '-style')?.remove();
}

// ---------------------------------------------------------------------------
// Meeting-end detection
// ---------------------------------------------------------------------------

function isOnActiveMeetingPage() {
  const host = location.hostname;
  const path = location.pathname;

  if (host.includes('meet.google.com')) {
    // Active call: /abc-defg-hij pattern
    return /^\/[a-z]{3}-[a-z]{4}-[a-z]{3}(\/|$)/.test(path);
  }
  if (host.includes('zoom.us')) {
    return path.startsWith('/j/') || path.startsWith('/wc/');
  }
  if (host.includes('teams.microsoft.com')) {
    return path.includes('/meet/') || path.includes('/call/') || path.includes('/meetings/');
  }
  return false;
}

function setupMeetingEndDetection() {
  // Watch for Google Meet navigating back to the home screen (call ended)
  let wasInCall = isOnActiveMeetingPage();

  const observer = new MutationObserver(() => {
    const nowInCall = isOnActiveMeetingPage();
    if (wasInCall && !nowInCall) {
      wasInCall = false;
      chrome.runtime.sendMessage({ type: 'MEETING_ENDED' });
    }
    // If navigated back into a call (e.g. rejoin), reset
    if (!wasInCall && nowInCall) wasInCall = true;
  });

  // Observe <title> changes — Google Meet updates document.title when call ends
  const titleEl = document.querySelector('title');
  if (titleEl) {
    observer.observe(titleEl, { childList: true, subtree: true, characterData: true });
  }
  // Also observe body for structural changes (Teams/Zoom overlay)
  observer.observe(document.body, { childList: true, subtree: false });
}

// ---------------------------------------------------------------------------
// Message handler
// ---------------------------------------------------------------------------

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'BASHA_GET_PARTICIPANTS') {
    sendResponse({ participants: scrapeParticipants() });
  }
});

// ---------------------------------------------------------------------------
// Init
// ---------------------------------------------------------------------------

chrome.storage.session.get(['isRecording'], ({ isRecording }) => {
  if (isRecording) {
    createIndicator();
  } else {
    // Show the start-recording prompt once when user is actively in a call
    if (isOnActiveMeetingPage()) {
      showStartToast();
    }
  }
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'session') return;
  if ('isRecording' in changes) {
    if (changes.isRecording.newValue) {
      removeStartToast();
      createIndicator();
    } else {
      removeIndicator();
    }
  }
});

// Start meeting-end watcher
setupMeetingEndDetection();
