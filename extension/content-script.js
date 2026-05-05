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
// RTC active-speaker timeline (Google Meet only)
// ---------------------------------------------------------------------------

/**
 * One entry per speaker-change event during the meeting.
 * We only push when the active speaker changes (not on every 500ms poll)
 * so the array stays compact even for long meetings.
 */
const activeSpeakerTimeline = []; // { name: string, timestampMs: number }[]
let lastRTCSpeakerName = null;

/**
 * Inject injected-rtc.js into the page context so it can hook RTCPeerConnection
 * (content scripts run in an isolated sandbox and cannot access window.RTCPeerConnection).
 * Only runs on Google Meet.
 */
function injectRTCHook() {
  // Inject on Google Meet and Microsoft Teams (both use WebRTC)
  const host = location.hostname;
  const isSupportedPlatform =
    host.includes('meet.google.com') ||
    host.includes('teams.microsoft.com') ||
    host.includes('teams.live.com');
  if (!isSupportedPlatform) return;
  if (document.getElementById('basha-rtc-injected')) return; // guard against double-inject
  const script = document.createElement('script');
  script.id = 'basha-rtc-injected';
  script.src = chrome.runtime.getURL('injected-rtc.js');
  (document.head || document.documentElement).appendChild(script);
  // The script tag is kept in DOM intentionally — removing it doesn't un-run it.
}

/**
 * Listen for BASHA_RTC_SPEAKERS events from injected-rtc.js.
 * For each loud track, walk the DOM to find the participant tile video element
 * whose srcObject contains that track, then extract the participant name.
 * Only records a new entry when the active speaker changes.
 */
window.addEventListener('message', (event) => {
  if (!event.data || event.data.type !== 'BASHA_RTC_SPEAKERS') return;
  const { speakers, timestampMs } = event.data;

  // Pick the loudest speaker from this poll tick
  const loudest = speakers.reduce(
    (best, s) => (s.audioLevel > (best?.audioLevel ?? 0) ? s : best),
    null
  );
  if (!loudest) return;

  let activeName = null;

  // ── Local user (isLocal: true from injected-rtc.js outbound-rtp) ────────────
  // The local user has no inbound video tile — use the scraped self-view name
  // (the first name in seenParticipants that matches the self-view tile, or
  // fall back to the first participant name we've ever seen).
  if (loudest.isLocal) {
    // Google Meet self-view tile: aria-label usually contains own name
    // Try .ZY8hPc.iPFm3e on the self-view, or the first seenParticipants entry
    for (const video of document.querySelectorAll('video')) {
      if (!video.srcObject) continue;
      // Self-view: outbound track is on the local stream (getVideoTracks present, no inbound audio)
      const localTrack = video.srcObject.getVideoTracks?.()[0];
      if (!localTrack) continue;
      // Walk up to find the name chip
      let cur = video.parentElement;
      while (cur && cur !== document.body) {
        const nameChip = cur.querySelector('.ZY8hPc.iPFm3e');
        if (nameChip) {
          activeName = cleanName(nameChip.querySelector('span')?.textContent?.trim() ?? nameChip.textContent?.trim());
          if (activeName) break;
        }
        cur = cur.parentElement;
      }
      if (activeName) break;
      activeName = nameFromAncestorAriaLabel(video);
      if (activeName) break;
    }
    // Final fallback: use first ever-seen participant name (likely ourselves in solo view)
    if (!activeName && seenParticipants.size > 0) {
      activeName = [...seenParticipants][0];
    }
  }

  // ── Remote participant: match trackId → media element → DOM tile ────────────
  if (!activeName) {
    // Search both <video> and <audio> elements — modern Meet puts audio on <audio>
    const mediaEls = [
      ...document.querySelectorAll('video'),
      ...document.querySelectorAll('audio'),
    ];

    for (const el of mediaEls) {
      if (!el.srcObject) continue;
      const track = el.srcObject.getAudioTracks?.().find((t) => t.id === loudest.trackId);
      if (!track) continue;

      // ── Google Meet: walk up to tile container, look for name chip ──────────
      let cur = el.parentElement;
      while (cur && cur !== document.body) {
        const nameChip = cur.querySelector('.ZY8hPc.iPFm3e');
        if (nameChip) {
          activeName = cleanName(nameChip.querySelector('span')?.textContent?.trim() ?? nameChip.textContent?.trim());
          if (activeName) break;
        }
        const moreBtn = cur.querySelector('.tTdl5d');
        if (moreBtn) {
          const match = (moreBtn.textContent?.trim() ?? '').match(/More options for (.+)/i);
          activeName = match ? cleanName(match[1]) : null;
          if (activeName) break;
        }
        cur = cur.parentElement;
      }

      // ── [data-participant-id] tile (older Meet UI) + Teams ──────────────────
      if (!activeName) {
        const tile =
          el.closest('[data-participant-id]') ??
          el.closest('[data-requested-participant-id]') ??
          el.closest('[data-tid="roster-participant"]') ??
          el.closest('[id^="video-tile-"]') ??
          el.closest('[class*="video-tile"]');
        if (tile) {
          activeName = cleanName(tile.getAttribute('aria-label'));
          if (!activeName) {
            const teamsEl = tile.querySelector('[data-tid="roster-participant-display-name"]');
            activeName = cleanName(teamsEl?.textContent?.trim()) ?? null;
          }
        }
      }

      // ── Last resort: ancestor aria-label walk ────────────────────────────────
      if (!activeName) activeName = nameFromAncestorAriaLabel(el);

      if (activeName) break;
    }
  }

  // Only record a new entry when the speaker changes (keeps array compact)
  if (activeName && activeName !== lastRTCSpeakerName) {
    activeSpeakerTimeline.push({ name: activeName, timestampMs });
    lastRTCSpeakerName = activeName;
  }
});

// Inject immediately on load (Meet may already have set up RTCPeerConnections by
// document_idle, so we inject as early as possible)
injectRTCHook();

// ---------------------------------------------------------------------------
// Participant name scraping (Google Meet)
// ---------------------------------------------------------------------------

const EXCLUDE_NAMES = new Set([
  'you', 'muted', 'unmuted', 'pin', 'more', 'options', 'remove',
  'message', 'spotlight', 'tile', 'participant', 'host',
]);

// Words that appear in UI instruction labels (tooltips, keyboard hints, ARIA).
// Any candidate name containing one of these is rejected.
const INSTRUCTION_WORDS = new Set([
  'press', 'arrow', 'escape', 'hover', 'tray', 'click', 'drag',
  'scroll', 'swipe', 'button', 'keyboard', 'shortcut', 'open', 'close',
  'expand', 'collapse', 'navigate', 'select', 'focus',
]);

/**
 * Clean and validate a candidate name string.
 * Returns the cleaned name, or null if it looks like a UI label / junk.
 *
 * Rules:
 *   - Strip parenthetical suffixes "(Muted)", ", unmuted", etc.
 *   - 2–60 characters after cleaning
 *   - At most 4 words (real names are 1–4 words; longer = instruction text)
 *   - None of the words appear in INSTRUCTION_WORDS
 *   - Not in EXCLUDE_NAMES
 *   - Not a pure number
 */
function cleanName(raw) {
  if (!raw) return null;
  const clean = raw.replace(/\s*\(.*?\)\s*/g, '').replace(/\s*,.*$/, '').trim();
  if (!clean || clean.length < 2 || clean.length > 60) return null;
  const words = clean.split(/\s+/);
  if (
    words.length > 4 ||
    EXCLUDE_NAMES.has(clean.toLowerCase()) ||
    /^\d+$/.test(clean) ||
    /[_]/.test(clean) ||
    words.some((w) => INSTRUCTION_WORDS.has(w.toLowerCase()))
  ) return null;
  return clean;
}

/**
 * Walk up the DOM from `el` looking for the nearest ancestor whose aria-label
 * looks like a person's name (short, not a UI element label).
 * Stops at <body>. Returns the cleaned name or null.
 *
 * This handles Google Meet's newer UI where participant tiles are plain divs
 * with aria-label="Saisiddharth" rather than [data-participant-id] elements.
 */
function nameFromAncestorAriaLabel(el) {
  let cur = el?.parentElement;
  while (cur && cur !== document.body) {
    const label = cur.getAttribute('aria-label');
    const name = cleanName(label);
    if (name) return name;
    cur = cur.parentElement;
  }
  return null;
}

// Accumulated set of participant names seen since page load.
// Updated by scrapeAndAccumulate() on every DOM mutation and explicit requests.
// Using a Set ensures no duplicates even across multiple scrapes.
const seenParticipants = new Set();

function scrapeParticipants() {
  const names = new Set();

  // Approach 1: Google Meet name overlay — .ZY8hPc.iPFm3e
  // This is the visible bottom-left name chip on each video tile. Contains a
  // <span> with the participant's display name.
  document.querySelectorAll('.ZY8hPc.iPFm3e').forEach((el) => {
    const name = cleanName(el.querySelector('span')?.textContent?.trim() ?? el.textContent?.trim());
    if (name) names.add(name);
  });

  // Approach 2: Hidden "More options for <Name>" accessibility button inside .tTdl5d
  // display:none but contains the full name reliably.
  document.querySelectorAll('.tTdl5d').forEach((el) => {
    const text = el.textContent?.trim() ?? '';
    const match = text.match(/More options for (.+)/i);
    if (match) {
      const name = cleanName(match[1]);
      if (name) names.add(name);
    }
  });

  // Approach 3: data-participant-id / data-requested-participant-id tiles (older Meet UI)
  document.querySelectorAll('[data-participant-id], [data-requested-participant-id]').forEach((tile) => {
    const name = cleanName(tile.getAttribute('aria-label'));
    if (name) { names.add(name); return; }
    const walker = document.createTreeWalker(tile, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walker.nextNode())) {
      const text = node.textContent?.trim() ?? '';
      if (text.length >= 2 && text.length <= 60 && !EXCLUDE_NAMES.has(text.toLowerCase()) && !/^\d+$/.test(text)) {
        names.add(text);
        break;
      }
    }
  });

  // Approach 4: aria-label ancestor walk from each <video> element.
  // Handles cases where tiles are plain divs with aria-label="Name".
  document.querySelectorAll('video').forEach((video) => {
    const name = nameFromAncestorAriaLabel(video);
    if (name) names.add(name);
  });

  // Approach 5: obfuscated class-based selectors (last resort — may change over time)
  if (names.size === 0) {
    const selectors = ['.zWfAib', '.KF4T6b', '.cS7aqe', '.YTbUzc', '.dwSJ2e'];
    for (const sel of selectors) {
      document.querySelectorAll(sel).forEach((el) => {
        const text = el.textContent?.trim() ?? '';
        if (text.length >= 2 && text.length <= 80 && !EXCLUDE_NAMES.has(text.toLowerCase())) {
          names.add(text);
        }
      });
    }
  }

  return [...names];
}

/**
 * Scrape the DOM and add any new names to seenParticipants.
 * Called on every DOM mutation and on explicit BASHA_GET_PARTICIPANTS requests.
 */
function scrapeAndAccumulate() {
  for (const name of scrapeParticipants()) {
    seenParticipants.add(name);
  }
}

// Throttle MutationObserver callbacks — Google Meet DOM changes constantly;
// no need to scrape on every single mutation.
let scrapeThrottleTimer = null;
function scheduleScrape() {
  if (scrapeThrottleTimer) return;
  scrapeThrottleTimer = setTimeout(() => {
    scrapeThrottleTimer = null;
    scrapeAndAccumulate();
  }, 2000); // debounce: 2 seconds after last mutation
}

// Watch the whole document for new participant tiles appearing.
// This catches: late joiners, tiles that render after our initial scrape,
// and names that appear in the participant panel when opened.
const participantObserver = new MutationObserver(scheduleScrape);
participantObserver.observe(document.documentElement, { childList: true, subtree: true });

// Initial scrape on page load
scrapeAndAccumulate();

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
      width: 8px; height: 8px; background: #ef4444; border-radius: 50%;
      flex-shrink: 0;
      animation: basha-blink 1s step-start infinite;
    }
    @keyframes basha-blink { 0%,100%{opacity:1} 50%{opacity:0} }
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

  el.querySelector('.b-btn-record').addEventListener('click', () => {
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

// One-tap prompt shown after joining from waiting room — provides fresh user gesture for tabCapture
function showRecordNowPrompt() {
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
    #${PROMPT_ID}.basha-hiding { opacity: 0; pointer-events: none; }
    #${PROMPT_ID} .b-logo {
      width: 22px; height: 22px; border-radius: 6px;
      background: linear-gradient(135deg, #f59e0b, #f97316);
      display: flex; align-items: center; justify-content: center;
      font-weight: 800; font-size: 11px; color: #07071a; flex-shrink: 0;
    }
    #${PROMPT_ID} .b-btn-record {
      background: linear-gradient(135deg, #f59e0b, #f97316);
      border: none; border-radius: 14px;
      padding: 5px 12px; font-size: 11px; font-weight: 700;
      color: #07071a; cursor: pointer; flex-shrink: 0;
    }
    #${PROMPT_ID} .b-btn-dismiss {
      background: transparent; border: 1px solid rgba(255,255,255,0.15);
      border-radius: 14px; padding: 5px 10px;
      font-size: 11px; font-weight: 500; color: #94a3b8;
      cursor: pointer; flex-shrink: 0;
    }
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
    <span class="b-text">You're in — start recording now?</span>
    <button class="b-btn-record">Start</button>
    <button class="b-btn-dismiss">Cancel</button>
  `;
  document.body.appendChild(el);

  el.querySelector('.b-btn-record').addEventListener('click', () => {
    el.querySelector('.b-text').textContent = 'Starting…';
    el.querySelector('.b-btn-record').style.display = 'none';
    el.querySelector('.b-btn-dismiss').style.display = 'none';
    chrome.runtime.sendMessage({ type: 'CONFIRM_START_RECORDING' });
    setTimeout(() => dismissPrompt(), 1500);
  });

  el.querySelector('.b-btn-dismiss').addEventListener('click', () => {
    chrome.storage.session.remove('pendingRecord');
    dismissPrompt();
  });
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
    // Do a fresh scrape before responding to catch any names not yet in seenParticipants
    scrapeAndAccumulate();
    sendResponse({
      participants: [...seenParticipants],
      activeSpeakerTimeline: [...activeSpeakerTimeline],
    });
  }
  if (message.type === 'RECORDING_STARTED_FROM_PROMPT') {
    removeRecordingPrompt();
  }
  if (message.type === 'RECORDING_QUEUED') {
    // Waiting room — update prompt to show queued state
    const el = document.getElementById(PROMPT_ID);
    if (el) {
      el.querySelector('.b-text').textContent = 'Will record when you join';
      el.querySelector('.b-btn-record').style.display = 'none';
      el.querySelector('.b-btn-dismiss').textContent = 'Cancel';
    }
  }
  if (message.type === 'SHOW_RECORD_NOW') {
    // User has joined the meeting — show a one-tap confirm button
    // (new user gesture needed for tabCapture)
    removeRecordingPrompt();
    promptDismissed = false;
    showRecordNowPrompt();
  }
  if (message.type === 'AUTO_START_FAILED') {
    const el = document.getElementById(PROMPT_ID);
    if (el) {
      el.querySelector('.b-text').textContent = message.error || 'Could not start — check extension token';
      el.querySelector('.b-btn-record').style.display = 'none';
      el.querySelector('.b-btn-dismiss').textContent = 'Dismiss';
    }
  }
});

// ---------------------------------------------------------------------------
// Init
// ---------------------------------------------------------------------------

chrome.storage.session.get(['isRecording'], (result) => {
  const isRecording = result?.isRecording ?? false;
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
