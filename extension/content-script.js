/**
 * Basha Chrome Extension — Meeting page content script (content-script.js)
 *
 * Injected into: Google Meet, Zoom web, Microsoft Teams
 *
 * Responsibilities:
 *  1. Inject a floating "Basha recording" pill when the extension is recording
 *  2. Remove the pill when recording stops
 */

const INDICATOR_ID = 'basha-rec-indicator';

// ---------------------------------------------------------------------------
// Participant name scraping (Google Meet)
// ---------------------------------------------------------------------------

const EXCLUDE_NAMES = new Set([
  'you', 'muted', 'unmuted', 'pin', 'more', 'options', 'remove',
  'message', 'spotlight', 'tile', 'participant', 'host',
]);

function scrapeParticipants() {
  const names = new Set();

  // Google Meet tile name selectors — try several in case Google updates the DOM
  const selectors = [
    '.zWfAib',        // main tile name label (most common)
    '.KF4T6b',        // secondary tile name class
    '.cS7aqe',        // tile overlay name
    '.YTbUzc',        // participants panel list item name
    '.dwSJ2e',        // another known Meet name class
  ];

  for (const sel of selectors) {
    document.querySelectorAll(sel).forEach((el) => {
      const text = el.textContent?.trim() ?? '';
      if (text.length >= 2 && text.length <= 80 && !EXCLUDE_NAMES.has(text.toLowerCase())) {
        names.add(text);
      }
    });
  }

  // Fallback: [data-participant-id] containers — look for short text nodes inside
  document.querySelectorAll('[data-participant-id]').forEach((tile) => {
    const spans = tile.querySelectorAll('span, div');
    for (const span of spans) {
      const text = span.textContent?.trim() ?? '';
      if (
        text.length >= 2 &&
        text.length <= 60 &&
        !EXCLUDE_NAMES.has(text.toLowerCase()) &&
        span.children.length === 0  // leaf text node only
      ) {
        names.add(text);
        break; // one name per tile
      }
    }
  });

  return [...names];
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'BASHA_GET_PARTICIPANTS') {
    sendResponse({ participants: scrapeParticipants() });
  }
});

function createIndicator() {
  if (document.getElementById(INDICATOR_ID)) return;

  const el = document.createElement('div');
  el.id = INDICATOR_ID;
  el.innerHTML = `
    <span style="
      display:inline-flex;align-items:center;gap:6px;
      background:rgba(15,23,42,0.92);
      border:1px solid #ef4444;
      border-radius:20px;
      padding:5px 12px;
      font-size:12px;font-weight:600;
      color:#fca5a5;
      font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
      pointer-events:none;
    ">
      <span style="
        width:7px;height:7px;background:#ef4444;border-radius:50%;
        animation:basha-pulse 1.2s infinite;
      "></span>
      Basha recording
    </span>
  `;

  const style = document.createElement('style');
  style.textContent = `
    #${INDICATOR_ID} {
      position: fixed;
      bottom: 80px;
      left: 50%;
      transform: translateX(-50%);
      z-index: 99999;
      pointer-events: none;
    }
    @keyframes basha-pulse {
      0%,100% { opacity:1; }
      50% { opacity:0.3; }
    }
  `;
  document.head.appendChild(style);
  document.body.appendChild(el);
}

function removeIndicator() {
  document.getElementById(INDICATOR_ID)?.remove();
}

// Check initial state and set up listener
chrome.storage.session.get(['isRecording'], ({ isRecording }) => {
  if (isRecording) createIndicator();
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'session') return;
  if ('isRecording' in changes) {
    if (changes.isRecording.newValue) {
      createIndicator();
    } else {
      removeIndicator();
    }
  }
});
