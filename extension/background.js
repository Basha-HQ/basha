/**
 * Basha Chrome Extension — Service Worker (background.js)
 *
 * Bot-only mode: no local audio capture.
 * When the user clicks "Record" in the in-page prompt or the popup,
 * we call POST /api/extension/bot which dispatches a Recall.ai bot
 * into the meeting. The popup polls /api/extension/status/:id for updates.
 */

const APP_ORIGINS = ['https://trybasha.in'];

const MEETING_URL_RE =
  /meet\.google\.com\/[a-z]|zoom\.us\/(j|wc)\/|app\.zoom\.us|teams\.(microsoft|live)\.com/;

// ---------------------------------------------------------------------------
// Storage helpers
// ---------------------------------------------------------------------------

async function getToken() {
  const { extensionToken } = await chrome.storage.local.get('extensionToken');
  return extensionToken || null;
}

async function getAppOrigin() {
  const { appOrigin } = await chrome.storage.local.get('appOrigin');
  return appOrigin || APP_ORIGINS[0];
}

// ---------------------------------------------------------------------------
// API helpers
// ---------------------------------------------------------------------------

async function apiPost(path, body) {
  const [token, origin] = await Promise.all([getToken(), getAppOrigin()]);
  if (!token) throw new Error('No extension token — connect extension in Basha settings.');
  const res = await fetch(`${origin}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => res.status.toString());
    throw new Error(`API ${path} failed (${res.status}): ${text}`);
  }
  return res.json();
}

// ---------------------------------------------------------------------------
// Notify popup of state changes
// ---------------------------------------------------------------------------

function notifyPopup(data) {
  chrome.runtime.sendMessage({ type: 'STATE_UPDATE', ...data }).catch(() => {});
}

// ---------------------------------------------------------------------------
// Launch bot
// ---------------------------------------------------------------------------

async function launchBot(meetingUrl) {
  const token = await getToken();
  if (!token) {
    return { error: 'No extension token. Connect extension in Basha settings.' };
  }
  try {
    const data = await apiPost('/api/extension/bot', { meetingUrl });
    const { meetingId } = data;
    await chrome.storage.session.set({ botMeetingId: meetingId, botMeetingUrl: meetingUrl });
    if (meetingUrl) chrome.storage.local.set({ lastMeetingUrl: meetingUrl });
    return { success: true, meetingId };
  } catch (err) {
    return { error: err.message };
  }
}

// ---------------------------------------------------------------------------
// Message handler
// ---------------------------------------------------------------------------

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'GET_STATE') {
    (async () => {
      const { botMeetingId, botMeetingUrl } = await chrome.storage.session.get([
        'botMeetingId',
        'botMeetingUrl',
      ]);
      sendResponse({ botMeetingId: botMeetingId || null, botMeetingUrl: botMeetingUrl || null });
    })();
    return true;
  }

  if (message.type === 'CHECK_AUTH') {
    getToken().then((token) => sendResponse({ authed: !!token }));
    return true;
  }

  if (message.type === 'SET_APP_ORIGIN') {
    chrome.storage.local.set({ appOrigin: message.origin }).then(() =>
      sendResponse({ success: true })
    );
    return true;
  }

  // Token relay from content-script-app.js (trybasha.in settings page)
  if (message.type === 'SET_EXTENSION_TOKEN') {
    chrome.storage.local.set({
      extensionToken: message.token,
      appOrigin: message.origin || APP_ORIGINS[0],
    }).then(() => {
      sendResponse({ success: true });
      notifyPopup({ authed: true });
    });
    return true;
  }

  // Content-script prompt: "Record" button clicked — launch bot
  if (message.type === 'LAUNCH_BOT' || message.type === 'AUTO_START_RECORDING') {
    const meetingUrl = message.meetingUrl;
    launchBot(meetingUrl).then((result) => {
      const tabId = _sender.tab?.id;
      if (tabId) {
        chrome.tabs.sendMessage(tabId, { type: 'BOT_LAUNCH_RESULT', ...result }).catch(() => {});
      }
      sendResponse(result);
    });
    return true;
  }

  return false;
});

// ---------------------------------------------------------------------------
// Badge — dot on extension icon when on a meeting page
// ---------------------------------------------------------------------------

async function updateBadgeForTab(tabId, url) {
  if (!url) return;
  if (MEETING_URL_RE.test(url)) {
    chrome.action.setBadgeText({ text: '●', tabId });
    chrome.action.setBadgeBackgroundColor({ color: '#f59e0b', tabId });
  } else {
    chrome.action.setBadgeText({ text: '', tabId });
  }
}

chrome.tabs.onActivated.addListener(async ({ tabId }) => {
  const tab = await chrome.tabs.get(tabId).catch(() => null);
  if (tab?.url) updateBadgeForTab(tabId, tab.url);
});

chrome.tabs.onUpdated.addListener((_tabId, changeInfo, tab) => {
  if (changeInfo.url) updateBadgeForTab(tab.id, changeInfo.url);
});
