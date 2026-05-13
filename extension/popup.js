/**
 * Basha Chrome Extension — Popup script (popup.js)
 * Bot-only mode: no local recording.
 */

const APP_ORIGINS = ['https://trybasha.in'];

const MEETING_PATTERNS = [
  { re: /meet\.google\.com\/[a-z]/, label: 'Google Meet' },
  { re: /zoom\.us\/(j|wc)\/|app\.zoom\.us/, label: 'Zoom' },
  { re: /teams\.(microsoft|live)\.com/, label: 'Microsoft Teams' },
  { re: /webex\.com\/meet\/|\.webex\.com\/j\//, label: 'Webex' },
];

const BOT_URL_RE =
  /meet\.google\.com\/|zoom\.us\/(j|wc)\/|app\.zoom\.us|teams\.(microsoft|live)\.com|webex\.com\/meet\/|\.webex\.com\/j\//;

let botPollInterval = null;

// ---------------------------------------------------------------------------
// Utilities
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

function truncateUrl(url) {
  try {
    const u = new URL(url);
    return u.hostname + u.pathname.slice(0, 30) + (u.pathname.length > 30 ? '…' : '');
  } catch {
    return url.slice(0, 40);
  }
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

// ---------------------------------------------------------------------------
// Bot status label
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

      document.getElementById('bot-status-label').textContent = botPhaseLabel(data.botPhase, data.status);

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
// Reset to idle
// ---------------------------------------------------------------------------

async function resetToIdleState() {
  stopBotPoll();
  await chrome.storage.session.remove(['botMeetingId', 'botMeetingUrl']);

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const tabUrl = tab?.url || '';
  const matched = MEETING_PATTERNS.find(({ re }) => re.test(tabUrl));

  const { extensionToken } = await chrome.storage.local.get('extensionToken');
  if (!extensionToken) {
    showView('view-auth');
    return;
  }

  if (matched) {
    document.getElementById('bot-url-input').value = tabUrl;
  }
  showView('view-bot-mode');
}

// ---------------------------------------------------------------------------
// Init
// ---------------------------------------------------------------------------

async function init() {
  const { extensionToken } = await chrome.storage.local.get('extensionToken');
  const origin = await getOrigin();

  if (!extensionToken) {
    document.getElementById('btn-open-app').href = `${origin}/settings`;
    showView('view-auth');
    return;
  }

  document.getElementById('btn-bot-mode-app').href = `${origin}/dashboard`;

  // Restore an in-flight bot session
  const { botMeetingId, botMeetingUrl } = await chrome.storage.session.get([
    'botMeetingId',
    'botMeetingUrl',
  ]);
  if (botMeetingId) {
    document.getElementById('bot-status-url').textContent = botMeetingUrl
      ? truncateUrl(botMeetingUrl)
      : '';
    showView('view-bot-active');
    await startBotPolling(botMeetingId, extensionToken, origin);
    return;
  }

  // If the current tab is a meeting page, pre-fill the URL input
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const tabUrl = tab?.url || '';
  if (isValidMeetingUrl(tabUrl)) {
    document.getElementById('bot-url-input').value = tabUrl;
  }

  showView('view-bot-mode');
}

// ---------------------------------------------------------------------------
// Launch bot button
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

document.getElementById('bot-url-input').addEventListener('input', () => {
  document.getElementById('url-error').style.display = 'none';
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

document.getElementById('btn-new-recording').addEventListener('click', resetToIdleState);
document.getElementById('btn-retry').addEventListener('click', resetToIdleState);

// ---------------------------------------------------------------------------
// State updates from background
// ---------------------------------------------------------------------------

chrome.runtime.onMessage.addListener((message) => {
  if (message.type === 'STATE_UPDATE' && message.authed) {
    init();
  }
});

// ---------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------

init();
