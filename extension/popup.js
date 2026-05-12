/**
 * Basha Chrome Extension — Popup script (popup.js)
 */

const APP_ORIGINS = ['https://trybasha.in'];

const MEETING_PATTERNS = [
  { re: /meet\.google\.com\/[a-z]/, label: 'Google Meet' },
  { re: /zoom\.us\/(j|wc)\/|app\.zoom\.us/, label: 'Zoom' },
  { re: /teams\.(microsoft|live)\.com/, label: 'Microsoft Teams' },
  { re: /webex\.com\/meet\/|\.webex\.com\/j\//, label: 'Webex' },
];

// Supported meeting URL patterns for bot launching (broader than tab detection)
const BOT_URL_RE =
  /meet\.google\.com\/|zoom\.us\/(j|wc)\/|app\.zoom\.us|teams\.(microsoft|live)\.com|webex\.com\/meet\/|\.webex\.com\/j\//;

let timerInterval = null;
let botPollInterval = null;
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

function stopBotPoll() {
  if (botPollInterval) { clearInterval(botPollInterval); botPollInterval = null; }
}

async function getOrigin() {
  const { appOrigin } = await chrome.storage.local.get('appOrigin');
  return appOrigin || APP_ORIGINS[0];
}

function isValidMeetingUrl(url) {
  return BOT_URL_RE.test(url);
}

function truncateUrl(url) {
  try {
    const u = new URL(url);
    return u.hostname + u.pathname.slice(0, 30) + (u.pathname.length > 30 ? '…' : '');
  } catch {
    return url.slice(0, 40);
  }
}

// ---------------------------------------------------------------------------
// Bot status label mapping
// ---------------------------------------------------------------------------

function botPhaseLabel(botPhase, meetingStatus) {
  if (meetingStatus === 'completed') return 'Done';
  if (meetingStatus === 'failed') return 'Failed';
  if (meetingStatus === 'processing') return 'Processing transcript…';
  switch (botPhase) {
    case 'joining': return 'Joining meeting…';
    case 'in_meeting': return 'Bot in meeting';
    case 'recording': return 'Recording…';
    case 'leaving': return 'Meeting ended, processing…';
    default: return 'Joining meeting…';
  }
}

// ---------------------------------------------------------------------------
// Bot status polling
// ---------------------------------------------------------------------------

async function startBotPolling(meetingId, authToken, origin) {
  stopBotPoll();

  document.getElementById('btn-bot-dashboard').href = `${origin}/meetings/${meetingId}`;
  document.getElementById('bot-status-label').textContent = 'Joining meeting…';

  botPollInterval = setInterval(async () => {
    try {
      const res = await fetch(`${origin}/api/extension/status/${meetingId}`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      if (!res.ok) return;
      const data = await res.json();

      const label = botPhaseLabel(data.botPhase, data.status);
      document.getElementById('bot-status-label').textContent = label;

      if (data.status === 'completed') {
        stopBotPoll();
        await chrome.storage.session.remove('botMeetingId');
        document.getElementById('btn-view-notes').href = `${origin}${data.meetingUrl}`;
        showView('view-done');
      } else if (data.status === 'failed') {
        stopBotPoll();
        await chrome.storage.session.remove('botMeetingId');
        document.getElementById('error-msg').textContent = 'Bot failed to process the meeting.';
        showView('view-failed');
      }
    } catch {
      // network hiccup — keep polling
    }
  }, 3000);
}

// ---------------------------------------------------------------------------
// After "View Notes" or "New Recording" — reset to idle
// ---------------------------------------------------------------------------

async function resetToIdleState() {
  stopTimer();
  stopBotPoll();
  await chrome.storage.session.remove(['status', 'meetingId', 'processingUrl', 'error', 'botMeetingId']);
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const matched = MEETING_PATTERNS.find(({ re }) => re.test(tab?.url || ''));
  if (matched) {
    currentMeetingUrl = tab.url;
    document.getElementById('meeting-platform').textContent = matched.label;
    showView('view-ready');
  } else {
    const { extensionToken } = await chrome.storage.local.get('extensionToken');
    if (!extensionToken) {
      showView('view-auth');
    } else {
      showView('view-bot-mode');
    }
  }
}

// ---------------------------------------------------------------------------
// Init
// ---------------------------------------------------------------------------

async function init() {
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
    const origin = await getOrigin();
    if (state.processingUrl) {
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

  // Check auth token
  const { extensionToken } = await chrome.storage.local.get('extensionToken');
  if (!extensionToken) {
    const origin = await getOrigin();
    document.getElementById('btn-open-app').href = `${origin}/settings`;
    showView('view-auth');
    return;
  }

  const origin = await getOrigin();
  document.getElementById('btn-bot-mode-app').href = `${origin}/dashboard`;

  // If there's an in-flight bot session, restore it
  const { botMeetingId } = await chrome.storage.session.get('botMeetingId');
  if (botMeetingId) {
    const urlStore = await chrome.storage.session.get('botMeetingUrl');
    document.getElementById('bot-status-url').textContent = urlStore.botMeetingUrl
      ? truncateUrl(urlStore.botMeetingUrl)
      : '';
    showView('view-bot-active');
    await startBotPolling(botMeetingId, extensionToken, origin);
    return;
  }

  showView('view-bot-mode');
}

// ---------------------------------------------------------------------------
// Launch Bot button
// ---------------------------------------------------------------------------

document.getElementById('btn-launch-bot').addEventListener('click', async () => {
  const input = document.getElementById('bot-url-input');
  const errorEl = document.getElementById('url-error');
  const meetingUrl = input.value.trim();

  errorEl.style.display = 'none';

  if (!meetingUrl || !isValidMeetingUrl(meetingUrl)) {
    errorEl.style.display = 'block';
    input.focus();
    return;
  }

  const { extensionToken } = await chrome.storage.local.get('extensionToken');
  if (!extensionToken) {
    showView('view-auth');
    return;
  }

  const origin = await getOrigin();
  const btn = document.getElementById('btn-launch-bot');
  btn.textContent = 'Launching…';
  btn.disabled = true;

  try {
    const res = await fetch(`${origin}/api/extension/bot`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${extensionToken}`,
      },
      body: JSON.stringify({ meetingUrl }),
    });

    const data = await res.json();

    if (!res.ok) {
      errorEl.textContent = data.error || 'Failed to launch bot. Try again.';
      errorEl.style.display = 'block';
      btn.textContent = 'Launch Bot';
      btn.disabled = false;
      return;
    }

    const { meetingId } = data;
    await chrome.storage.session.set({ botMeetingId: meetingId, botMeetingUrl: meetingUrl });

    document.getElementById('bot-status-url').textContent = truncateUrl(meetingUrl);
    document.getElementById('bot-status-label').textContent = 'Joining meeting…';
    document.getElementById('btn-bot-dashboard').href = `${origin}/meetings/${meetingId}`;
    showView('view-bot-active');
    await startBotPolling(meetingId, extensionToken, origin);
  } catch {
    errorEl.textContent = 'Network error. Check your connection and try again.';
    errorEl.style.display = 'block';
    btn.textContent = 'Launch Bot';
    btn.disabled = false;
  }
});

// Clear error on input change
document.getElementById('bot-url-input').addEventListener('input', () => {
  document.getElementById('url-error').style.display = 'none';
});

// ---------------------------------------------------------------------------
// Start recording (extension tab-capture — legacy flow)
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

document.getElementById('btn-open-meet').addEventListener('click', async () => {
  const { lastMeetingUrl } = await chrome.storage.local.get('lastMeetingUrl');
  let url = 'https://meet.google.com/new';
  if (lastMeetingUrl) {
    if (lastMeetingUrl.includes('zoom.us')) url = 'https://zoom.us/start/videomeeting';
    else if (lastMeetingUrl.includes('teams.microsoft.com') || lastMeetingUrl.includes('teams.live.com')) url = 'https://teams.microsoft.com';
    else if (lastMeetingUrl.includes('webex.com')) url = 'https://webex.com';
  }
  chrome.tabs.create({ url });
});

document.getElementById('btn-view-notes').addEventListener('click', () => {
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
