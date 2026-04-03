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
const PROMPT_ID = 'basha-record-prompt';

let promptDismissed = false;

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
// Interactive record prompt
// ---------------------------------------------------------------------------

function showRecordingPrompt() {
  console.log('[basha] showRecordingPrompt called, dismissed:', promptDismissed, 'exists:', !!document.getElementById(PROMPT_ID));
  if (promptDismissed) return;
  if (document.getElementById(PROMPT_ID)) return;

  const style = document.createElement('style');
  style.id = PROMPT_ID + '-style';
  style.textContent = `
    #${PROMPT_ID} {
      position: fixed; top: 24px; left: 50%;
      transform: translateX(-50%) translateY(0);
      z-index: 99999;
      display: flex; align-items: center; gap: 10px;
      background: rgba(13,15,26,0.97);
      border: 1px solid rgba(245,158,11,0.4);
      border-radius: 24px; padding: 8px 8px 8px 10px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      font-size: 12px; font-weight: 500; color: #e2e8f0;
      box-shadow: 0 4px 24px rgba(0,0,0,0.5);
      animation: basha-prompt-in 0.3s ease-out;
      white-space: nowrap;
      transition: opacity 0.3s ease;
    }
    #${PROMPT_ID}.basha-hiding {
      opacity: 0;
      pointer-events: none;
    }
    #${PROMPT_ID} .b-logo {
      width: 22px; height: 22px; border-radius: 6px;
      background: linear-gradient(135deg, #f59e0b, #f97316);
      display: flex; align-items: center; justify-content: center;
      font-weight: 800; font-size: 11px; color: #07071a; flex-shrink: 0;
    }
    #${PROMPT_ID} .b-text {
      flex: 1;
    }
    #${PROMPT_ID} .b-btn-record {
      background: linear-gradient(135deg, #f59e0b, #f97316);
      border: none; border-radius: 14px;
      padding: 5px 12px; font-size: 11px; font-weight: 700;
      color: #07071a; cursor: pointer; flex-shrink: 0;
      transition: opacity 0.15s;
    }
    #${PROMPT_ID} .b-btn-record:hover { opacity: 0.85; }
    #${PROMPT_ID} .b-btn-dismiss {
      background: transparent; border: 1px solid rgba(255,255,255,0.15);
      border-radius: 14px; padding: 5px 10px;
      font-size: 11px; font-weight: 500; color: #94a3b8;
      cursor: pointer; flex-shrink: 0;
      transition: border-color 0.15s, color 0.15s;
    }
    #${PROMPT_ID} .b-btn-dismiss:hover { border-color: rgba(255,255,255,0.35); color: #e2e8f0; }
    @keyframes basha-prompt-in {
      from { opacity: 0; transform: translateX(-50%) translateY(-12px); }
      to   { opacity: 1; transform: translateX(-50%) translateY(0); }
    }
  `;
  document.head.appendChild(style);

  const el = document.createElement('div');
  el.id = PROMPT_ID;
  el.innerHTML = `
    <div class="b-logo">B</div>
    <span class="b-text">Record this meeting?</span>
    <button class="b-btn-record">Record</button>
    <button class="b-btn-dismiss">Not now</button>
  `;
  document.body.appendChild(el);

  // Auto-dismiss after 10 seconds
  const autoDismissTimer = setTimeout(() => dismissPrompt(), 10000);

  el.querySelector('.b-btn-record').addEventListener('click', () => {
    clearTimeout(autoDismissTimer);
    // Show "Starting…" feedback
    el.querySelector('.b-text').textContent = 'Starting…';
    el.querySelector('.b-btn-record').style.display = 'none';
    el.querySelector('.b-btn-dismiss').style.display = 'none';
    chrome.runtime.sendMessage({
      type: 'AUTO_START_RECORDING',
      meetingUrl: location.href,
    });
    // Fade out after a beat
    setTimeout(() => dismissPrompt(), 1500);
  });

  el.querySelector('.b-btn-dismiss').addEventListener('click', () => {
    clearTimeout(autoDismissTimer);
    dismissPrompt();
  });
}

function dismissPrompt() {
  promptDismissed = true;
  const el = document.getElementById(PROMPT_ID);
  if (!el) return;
  el.classList.add('basha-hiding');
  setTimeout(() => {
    el.remove();
    document.getElementById(PROMPT_ID + '-style')?.remove();
  }, 320);
}

function removeRecordingPrompt() {
  document.getElementById(PROMPT_ID)?.remove();
  document.getElementById(PROMPT_ID + '-style')?.remove();
}

// ---------------------------------------------------------------------------
// Legacy passive toast (kept for reference, replaced by interactive prompt)
// ---------------------------------------------------------------------------

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

function setupMeetingDetection() {
  let wasInCall = isOnActiveMeetingPage();

  function checkCallState() {
    const nowInCall = isOnActiveMeetingPage();
    if (wasInCall && !nowInCall) {
      wasInCall = false;
      chrome.runtime.sendMessage({ type: 'MEETING_ENDED' });
    }
    if (!wasInCall && nowInCall) {
      wasInCall = true;
      chrome.storage.session.get(['isRecording'], (result) => {
        if (!result?.isRecording) showRecordingPrompt();
      });
    }
  }

  // MutationObserver for title/body changes (covers some navigation)
  const observer = new MutationObserver(checkCallState);
  const titleEl = document.querySelector('title');
  if (titleEl) {
    observer.observe(titleEl, { childList: true, subtree: true, characterData: true });
  }
  observer.observe(document.body, { childList: true, subtree: false });

  // Poll URL every 2s — catches SPA navigation via history.pushState
  // that doesn't trigger DOM mutations (Google Meet does this)
  setInterval(checkCallState, 2000);
}

// ---------------------------------------------------------------------------
// Message handler
// ---------------------------------------------------------------------------

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'BASHA_GET_PARTICIPANTS') {
    sendResponse({ participants: scrapeParticipants() });
  }
  if (message.type === 'RECORDING_STARTED_FROM_PROMPT') {
    removeRecordingPrompt();
  }
  if (message.type === 'AUTO_START_FAILED') {
    // Restore prompt state to show error briefly then dismiss
    const el = document.getElementById(PROMPT_ID);
    if (el) {
      el.querySelector('.b-text').textContent = message.error || 'Could not start — check extension token';
      setTimeout(() => dismissPrompt(), 3000);
    }
  }
});

// ---------------------------------------------------------------------------
// Init
// ---------------------------------------------------------------------------

console.log('[basha] content-script.js loaded on', location.href);
console.log('[basha] isOnActiveMeetingPage:', isOnActiveMeetingPage());

chrome.storage.session.get(['isRecording'], (result) => {
  const isRecording = result?.isRecording ?? false;
  console.log('[basha] init — isRecording:', isRecording, 'isActiveMeeting:', isOnActiveMeetingPage());
  if (isRecording) {
    createIndicator();
  } else {
    // Show the interactive record prompt when user is actively in a call
    if (isOnActiveMeetingPage()) {
      showRecordingPrompt();
    }
  }
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'session') return;
  if ('isRecording' in changes) {
    if (changes.isRecording.newValue) {
      removeStartToast();
      removeRecordingPrompt();
      createIndicator();
    } else {
      removeIndicator();
    }
  }
});

// Start meeting detection (enter + exit)
setupMeetingDetection();
