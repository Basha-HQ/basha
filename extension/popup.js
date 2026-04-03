/**
 * Basha Chrome Extension — Popup script (popup.js)
 */

const APP_ORIGINS = ['https://trybasha.in'];

const MEETING_PATTERNS = [
  { re: /meet\.google\.com\/[a-z]/, label: 'Google Meet' },
  { re: /zoom\.us\/(j|wc)\/|app\.zoom\.us/, label: 'Zoom' },
  { re: /teams\.(microsoft|live)\.com/, label: 'Microsoft Teams' },
];

let timerInterval = null;
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
    chrome.runtime.sendMessage({ type, ...data }, (resp) => resolve(resp || {}));
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
    el.textContent = formatTime(Math.floor((Date.now() - startedAt) / 1000));
  }, 1000);
}

function stopTimer() {
  if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
}

async function getOrigin() {
  const { appOrigin } = await chrome.storage.local.get('appOrigin');
  return appOrigin || APP_ORIGINS[0];
}

// ---------------------------------------------------------------------------
// After "View Notes" or "New Recording" — reset to idle
// ---------------------------------------------------------------------------

async function resetToIdleState() {
  stopTimer();
  await chrome.storage.session.remove(['status', 'meetingId', 'processingUrl', 'error']);
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const matched = MEETING_PATTERNS.find(({ re }) => re.test(tab?.url || ''));
  if (matched) {
    currentMeetingUrl = tab.url;
    document.getElementById('meeting-platform').textContent = matched.label;
    showView('view-ready');
  } else {
    showView('view-no-tab');
  }
}

// ---------------------------------------------------------------------------
// Init
// ---------------------------------------------------------------------------

async function init() {
  const { authed } = await send('CHECK_AUTH');
  if (!authed) {
    const origin = await getOrigin();
    document.getElementById('btn-open-app').href = `${origin}/dashboard/settings`;
    showView('view-auth');
    return;
  }

  const state = await send('GET_STATE');

  if (state.isRecording && state.status === 'recording') {
    showView('view-recording');
    startTimer(state.startedAt);
    return;
  }
  if (state.status === 'uploading') {
    document.getElementById('proc-title').textContent = 'Uploading audio…';
    document.getElementById('proc-sub').textContent = 'Please keep this window open';
    showView('view-processing');
    return;
  }
  if (state.status === 'processing') {
    document.getElementById('proc-title').textContent = 'Transcribing your meeting';
    document.getElementById('proc-sub').textContent = 'Sarvam AI is processing the audio…';
    showView('view-processing');
    return;
  }
  if (state.status === 'completed') {
    if (state.processingUrl) {
      const origin = await getOrigin();
      document.getElementById('btn-view-notes').href = `${origin}${state.processingUrl}`;
    }
    showView('view-done');
    return;
  }
  if (state.status === 'failed') {
    document.getElementById('error-msg').textContent = state.error || 'Something went wrong.';
    showView('view-failed');
    return;
  }

  // Idle — check current tab
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const matched = MEETING_PATTERNS.find(({ re }) => re.test(tab?.url || ''));
  if (matched) {
    currentMeetingUrl = tab.url;
    document.getElementById('meeting-platform').textContent = matched.label;
    showView('view-ready');
  } else {
    showView('view-no-tab');
  }
}

// ---------------------------------------------------------------------------
// Start recording
// ---------------------------------------------------------------------------

document.getElementById('btn-start').addEventListener('click', async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  try {
    const micStatus = await navigator.permissions.query({ name: 'microphone' });
    if (micStatus.state !== 'granted') {
      chrome.tabs.create({ url: chrome.runtime.getURL('mic-permission.html') });
      return;
    }
  } catch { /* proceed anyway */ }

  const selectedLang = document.getElementById('lang-select').value;
  chrome.storage.local.set({ lastSourceLanguage: selectedLang });

  document.getElementById('proc-title').textContent = 'Starting recording…';
  document.getElementById('proc-sub').textContent = 'Connecting to meeting audio';
  showView('view-processing');

  const result = await send('START_RECORDING', {
    tabId: tab.id,
    sourceLanguage: selectedLang,
    meetingUrl: currentMeetingUrl,
  });

  if (result.error) {
    document.getElementById('error-msg').textContent = result.error;
    showView('view-failed');
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
  document.getElementById('proc-title').textContent = 'Uploading audio…';
  document.getElementById('proc-sub').textContent = 'Please keep this window open';
  showView('view-processing');
  await send('STOP_RECORDING');
});

// ---------------------------------------------------------------------------
// Navigation buttons
// ---------------------------------------------------------------------------

document.getElementById('btn-open-meet').addEventListener('click', () => {
  chrome.tabs.create({ url: 'https://meet.google.com' });
});

document.getElementById('btn-view-notes').addEventListener('click', () => {
  // Link opens in new tab (target=_blank); then reset popup to idle
  setTimeout(() => resetToIdleState(), 100);
});

document.getElementById('btn-new-recording').addEventListener('click', () => {
  resetToIdleState();
});

document.getElementById('btn-retry').addEventListener('click', () => {
  resetToIdleState();
});

// ---------------------------------------------------------------------------
// Listen for state updates from background
// ---------------------------------------------------------------------------

chrome.runtime.onMessage.addListener(async (message) => {
  if (message.type !== 'STATE_UPDATE') return;

  if (message.isRecording && message.status === 'recording') {
    showView('view-recording');
    startTimer(message.startedAt);
  } else if (message.status === 'uploading') {
    stopTimer();
    document.getElementById('proc-title').textContent = 'Uploading audio…';
    document.getElementById('proc-sub').textContent = 'Please keep this window open';
    showView('view-processing');
  } else if (message.status === 'processing') {
    document.getElementById('proc-title').textContent = 'Transcribing your meeting';
    document.getElementById('proc-sub').textContent = 'Sarvam AI is processing the audio…';
    showView('view-processing');
  } else if (message.status === 'completed') {
    stopTimer();
    if (message.processingUrl) {
      const origin = await getOrigin();
      document.getElementById('btn-view-notes').href = `${origin}${message.processingUrl}`;
    }
    showView('view-done');
  } else if (message.status === 'failed') {
    stopTimer();
    document.getElementById('error-msg').textContent = message.error || 'Something went wrong.';
    showView('view-failed');
  } else if (message.authed) {
    init();
  }
});

// ---------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------

init();
