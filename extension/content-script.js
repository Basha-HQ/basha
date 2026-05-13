/**
 * Basha Chrome Extension — Meeting page content script (content-script.js)
 *
 * Injected into: Google Meet, Zoom web, Microsoft Teams
 *
 * Responsibilities:
 *  1. Show a floating prompt asking the user to launch the Basha bot
 *  2. On "Record": extract meeting URL and tell background.js to call the bot API
 *  3. Detect when the user navigates away from an active meeting
 */

const PROMPT_ID = 'basha-record-prompt';

let promptDismissed = false;

// ---------------------------------------------------------------------------
// Meeting-page detection
// ---------------------------------------------------------------------------

function isOnActiveMeetingPage() {
  const host = location.hostname;
  const path = location.pathname;

  if (host.includes('meet.google.com')) {
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

// ---------------------------------------------------------------------------
// Record prompt
// ---------------------------------------------------------------------------

function showRecordingPrompt() {
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
    #${PROMPT_ID} .b-text { flex: 1; }
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

  el.querySelector('.b-btn-record').addEventListener('click', () => {
    el.querySelector('.b-text').textContent = 'Sending bot…';
    el.querySelector('.b-btn-record').style.display = 'none';
    el.querySelector('.b-btn-dismiss').style.display = 'none';

    chrome.runtime.sendMessage({ type: 'LAUNCH_BOT', meetingUrl: location.href }, (resp) => {
      if (resp?.error) {
        el.querySelector('.b-text').textContent = resp.error;
        el.querySelector('.b-btn-dismiss').textContent = 'Dismiss';
        el.querySelector('.b-btn-dismiss').style.display = '';
      } else {
        el.querySelector('.b-text').textContent = 'Bot is joining…';
        setTimeout(() => dismissPrompt(), 2000);
      }
    });
  });

  el.querySelector('.b-btn-dismiss').addEventListener('click', dismissPrompt);
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

// ---------------------------------------------------------------------------
// Meeting enter/exit detection
// ---------------------------------------------------------------------------

function setupMeetingDetection() {
  let wasInCall = isOnActiveMeetingPage();

  function checkCallState() {
    const nowInCall = isOnActiveMeetingPage();
    if (!wasInCall && nowInCall) {
      wasInCall = true;
      if (!promptDismissed) showRecordingPrompt();
    }
    if (wasInCall && !nowInCall) {
      wasInCall = false;
    }
  }

  const titleEl = document.querySelector('title');
  if (titleEl) {
    new MutationObserver(checkCallState).observe(titleEl, {
      childList: true, subtree: true, characterData: true,
    });
  }
  new MutationObserver(checkCallState).observe(document.body, { childList: true, subtree: false });

  setInterval(checkCallState, 2000);
}

// ---------------------------------------------------------------------------
// Init
// ---------------------------------------------------------------------------

if (isOnActiveMeetingPage()) {
  showRecordingPrompt();
}

setupMeetingDetection();
