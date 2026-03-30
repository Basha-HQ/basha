/**
 * Basha Chrome Extension — Popup script (popup.js)
 *
 * Manages the 6-state popup UI and delegates recording control to background.js.
 */

const APP_ORIGINS = [
  'https://trybasha.in',
];

const MEETING_PATTERNS = [
  { re: /meet\.google\.com/, label: 'Google Meet' },
  { re: /zoom\.us\/j\//, label: 'Zoom' },
  { re: /teams\.microsoft\.com/, label: 'Microsoft Teams' },
];

let timerInterval = null;
let selectedLang = 'auto';
let currentMeetingUrl = '';

// ---------------------------------------------------------------------------
// Utility
// ---------------------------------------------------------------------------

function showView(id) {
  document.querySelectorAll('.view').forEach((v) => v.classList.remove('active'));
  document.getElementById(id)?.classList.add('active');
}

function send(type, data = {}) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ type, ...data }, (resp) => {
      resolve(resp || {});
    });
  });
}

function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function startTimer(startedAt) {
  if (timerInterval) clearInterval(timerInterval);
  const el = document.getElementById('rec-timer');
  timerInterval = setInterval(() => {
    const elapsed = Math.floor((Date.now() - startedAt) / 1000);
    el.textContent = formatTime(elapsed);
  }, 1000);
}

function stopTimer() {
  if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
}

// ---------------------------------------------------------------------------
// Init — detect active tab, check auth, show correct view
// ---------------------------------------------------------------------------

async function init() {
  const { authed } = await send('CHECK_AUTH');
  if (!authed) {
    // Show auth view with correct app origin link
    const { appOrigin } = await chrome.storage.local.get('appOrigin');
    const origin = appOrigin || APP_ORIGINS[0];
    document.getElementById('btn-open-app').href = `${origin}/dashboard/settings`;
    showView('view-auth');
    return;
  }

  // Check if already recording/processing
  const state = await send('GET_STATE');
  if (state.status === 'recording' && state.isRecording) {
    showView('view-recording');
    startTimer(state.startedAt);
    return;
  }
  if (state.status === 'uploading') { showView('view-uploading'); return; }
  if (state.status === 'processing') {
    showView('view-processing');
    if (state.processingUrl) {
      const origin = await getOrigin();
      const link = document.getElementById('btn-open-meeting');
      link.href = `${origin}${state.processingUrl}`;
      link.style.display = 'block';
    }
    return;
  }
  if (state.status === 'completed') {
    showView('view-completed');
    if (state.processingUrl) {
      const origin = await getOrigin();
      document.getElementById('btn-view-notes').href = `${origin}${state.processingUrl}`;
    }
    return;
  }
  if (state.status === 'failed') {
    showView('view-failed');
    document.getElementById('error-msg').textContent = state.error || 'Something went wrong.';
    return;
  }

  // Not recording — check if current tab is a meeting
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const matchedPlatform = MEETING_PATTERNS.find(({ re }) => re.test(tab?.url || ''));

  if (matchedPlatform) {
    currentMeetingUrl = tab.url;
    document.getElementById('meeting-platform').textContent = matchedPlatform.label;
    showView('view-ready');
  } else {
    showView('view-no-tab');
  }
}

async function getOrigin() {
  const { appOrigin } = await chrome.storage.local.get('appOrigin');
  return appOrigin || APP_ORIGINS[0];
}

// ---------------------------------------------------------------------------
// Language pill selection
// ---------------------------------------------------------------------------

document.getElementById('lang-pills').addEventListener('click', (e) => {
  const pill = e.target.closest('.lang-pill');
  if (!pill) return;
  document.querySelectorAll('.lang-pill').forEach((p) => p.classList.remove('selected'));
  pill.classList.add('selected');
  selectedLang = pill.dataset.lang;
});

// ---------------------------------------------------------------------------
// Start recording
// ---------------------------------------------------------------------------

document.getElementById('btn-start').addEventListener('click', async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  // Check if microphone permission is already granted.
  // We can't request it from the popup (popup closes when the prompt appears).
  // If not granted, open a dedicated tab for one-time mic setup.
  try {
    const micStatus = await navigator.permissions.query({ name: 'microphone' });
    if (micStatus.state !== 'granted') {
      // Open mic permission page in a new tab — user grants once, then it persists
      chrome.tabs.create({ url: chrome.runtime.getURL('mic-permission.html') });
      return; // User will click Start Recording again after granting
    }
  } catch {
    // permissions.query not supported — try to proceed anyway
  }

  showView('view-uploading'); // Optimistic feedback while we wait

  const result = await send('START_RECORDING', {
    tabId: tab.id,
    sourceLanguage: selectedLang,
    meetingUrl: currentMeetingUrl,
  });

  if (result.error) {
    showView('view-failed');
    document.getElementById('error-msg').textContent = result.error;
    return;
  }

  showView('view-recording');
  startTimer(Date.now());
});

// ---------------------------------------------------------------------------
// Stop recording
// ---------------------------------------------------------------------------

document.getElementById('btn-stop').addEventListener('click', async () => {
  stopTimer();
  showView('view-uploading');
  await send('STOP_RECORDING');
});

// ---------------------------------------------------------------------------
// Navigation buttons
// ---------------------------------------------------------------------------

document.getElementById('btn-open-meet').addEventListener('click', () => {
  chrome.tabs.create({ url: 'https://meet.google.com' });
});

document.getElementById('btn-record-another').addEventListener('click', async () => {
  await chrome.storage.session.clear();
  window.location.reload();
});

document.getElementById('btn-retry').addEventListener('click', async () => {
  await chrome.storage.session.clear();
  window.location.reload();
});

// ---------------------------------------------------------------------------
// Listen for state updates from background
// ---------------------------------------------------------------------------

chrome.runtime.onMessage.addListener((message) => {
  if (message.type !== 'STATE_UPDATE') return;

  if (message.status === 'recording' && message.isRecording) {
    showView('view-recording');
    startTimer(message.startedAt);
  } else if (message.status === 'uploading') {
    stopTimer();
    showView('view-uploading');
  } else if (message.status === 'processing') {
    showView('view-processing');
  } else if (message.status === 'completed') {
    showView('view-completed');
    if (message.processingUrl) {
      getOrigin().then((origin) => {
        document.getElementById('btn-view-notes').href = `${origin}${message.processingUrl}`;
      });
    }
  } else if (message.status === 'failed') {
    stopTimer();
    showView('view-failed');
    document.getElementById('error-msg').textContent = message.error || 'Something went wrong.';
  } else if (message.authed) {
    init();
  }
});

// ---------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------

init();
