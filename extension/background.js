/**
 * Basha Chrome Extension — Service Worker (background.js)
 *
 * Manages the recording state machine, communicates with the offscreen document
 * for MediaRecorder, and calls the Basha API.
 *
 * State machine: idle → recording → uploading → processing → completed / failed
 */

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const OFFSCREEN_URL = chrome.runtime.getURL('offscreen.html');
const ALARM_STATUS_POLL = 'basha-status-poll';
const STATUS_POLL_PERIOD_MINUTES = 0.5; // every 30 seconds

const APP_ORIGINS = [
  'https://trybasha.in',
];

// Allow content scripts to read chrome.storage.session
chrome.storage.session.setAccessLevel({ accessLevel: 'TRUSTED_AND_UNTRUSTED_CONTEXTS' });

// ---------------------------------------------------------------------------
// Helpers — offscreen document lifecycle
// ---------------------------------------------------------------------------

async function ensureOffscreenDocument() {
  const existing = await chrome.offscreen.hasDocument?.().catch(() => false);
  if (existing) return;
  await chrome.offscreen.createDocument({
    url: OFFSCREEN_URL,
    reasons: ['USER_MEDIA'],
    justification: 'Capture tab audio for meeting transcription',
  });
}

async function closeOffscreenDocument() {
  const existing = await chrome.offscreen.hasDocument?.().catch(() => false);
  if (existing) await chrome.offscreen.closeDocument();
}

// ---------------------------------------------------------------------------
// Helpers — storage
// ---------------------------------------------------------------------------

async function getState() {
  const data = await chrome.storage.session.get([
    'isRecording',
    'meetingId',
    'tabId',
    'startedAt',
    'sourceLanguage',
    'meetingUrl',
    'appOrigin',
    'status',
    'processingUrl',
    'error',
  ]);
  return data;
}

async function setState(updates) {
  await chrome.storage.session.set(updates);
}

async function clearRecordingState() {
  await chrome.storage.session.remove([
    'isRecording',
    'meetingId',
    'tabId',
    'startedAt',
    'meetingUrl',
    'status',
    'processingUrl',
    'error',
  ]);
}

// ---------------------------------------------------------------------------
// Helpers — API
// ---------------------------------------------------------------------------

async function getToken() {
  const { extensionToken } = await chrome.storage.local.get('extensionToken');
  return extensionToken || null;
}

async function getAppOrigin() {
  const { appOrigin } = await chrome.storage.local.get('appOrigin');
  return appOrigin || APP_ORIGINS[0];
}

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

async function apiGet(path) {
  const [token, origin] = await Promise.all([getToken(), getAppOrigin()]);
  if (!token) throw new Error('No extension token');
  const res = await fetch(`${origin}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`API ${path} failed (${res.status})`);
  return res.json();
}

// uploadAudio is now handled directly by the offscreen document
// to avoid Chrome messaging size limits on large audio blobs.

// ---------------------------------------------------------------------------
// Notify popup of state changes
// ---------------------------------------------------------------------------

function notifyPopup(data) {
  chrome.runtime.sendMessage({ type: 'STATE_UPDATE', ...data }).catch(() => {
    // Popup may not be open — ignore
  });
}

// ---------------------------------------------------------------------------
// START RECORDING
// ---------------------------------------------------------------------------

async function startRecording({ tabId, sourceLanguage, meetingUrl }) {
  const token = await getToken();
  if (!token) {
    return { error: 'No extension token. Connect extension in Basha settings.' };
  }

  // Get stream ID for tab audio (must be called from service worker context)
  let streamId;
  try {
    streamId = await chrome.tabCapture.getMediaStreamId({ targetTabId: tabId });
  } catch (err) {
    return { error: `Could not capture tab audio: ${err.message}` };
  }

  await ensureOffscreenDocument();

  // Scrape participant names from the meeting tab DOM
  let participantNames = [];
  try {
    const result = await chrome.tabs.sendMessage(tabId, { type: 'BASHA_GET_PARTICIPANTS' });
    participantNames = result?.participants ?? [];
    if (participantNames.length > 0) {
      console.log('[background] Captured participants from DOM:', participantNames);
    }
  } catch (err) {
    console.warn('[background] Could not scrape participant names:', err.message);
  }

  // Create meeting record via API
  let meetingId;
  try {
    const data = await apiPost('/api/extension/session', {
      sourceLanguage,
      meetingUrl,
      participantNames,
      startedAt: new Date().toISOString(),
    });
    meetingId = data.meetingId;
  } catch (err) {
    await closeOffscreenDocument();
    return { error: err.message };
  }

  // Start MediaRecorder in offscreen document — pass credentials so it can upload directly
  const origin = await getAppOrigin();
  chrome.runtime.sendMessage({
    target: 'offscreen',
    type: 'START_RECORDING',
    streamId,
    meetingId,
    token,
    origin,
  });

  await setState({
    isRecording: true,
    meetingId,
    tabId,
    startedAt: Date.now(),
    sourceLanguage,
    meetingUrl,
    status: 'recording',
  });

  notifyPopup({ isRecording: true, meetingId, startedAt: Date.now(), status: 'recording' });
  return { success: true, meetingId };
}

// ---------------------------------------------------------------------------
// STOP RECORDING — triggered by popup or by tab close
// ---------------------------------------------------------------------------

async function stopRecording() {
  const state = await getState();
  if (!state.isRecording) return { error: 'Not recording' };

  await setState({ isRecording: false, status: 'uploading' });
  notifyPopup({ isRecording: false, status: 'uploading' });

  // Signal offscreen document to stop — it will upload directly, then send UPLOAD_COMPLETE/UPLOAD_FAILED
  chrome.runtime.sendMessage({ target: 'offscreen', type: 'STOP_RECORDING' });
  return { success: true };
}

// ---------------------------------------------------------------------------
// Handle UPLOAD_COMPLETE / UPLOAD_FAILED from offscreen document
// ---------------------------------------------------------------------------

async function handleUploadComplete({ meetingId }) {
  console.log('[background] Upload complete for meeting:', meetingId);
  await setState({ status: 'processing', processingUrl: `/meetings/${meetingId}` });
  notifyPopup({ status: 'processing', meetingId, processingUrl: `/meetings/${meetingId}` });

  // Start polling alarm
  chrome.alarms.create(ALARM_STATUS_POLL, {
    periodInMinutes: STATUS_POLL_PERIOD_MINUTES,
  });

  await closeOffscreenDocument();
}

async function handleUploadFailed({ meetingId, error }) {
  console.error('[background] Upload/recording failed for', meetingId, ':', error);
  await setState({ status: 'failed', error });
  notifyPopup({ status: 'failed', error });
  await closeOffscreenDocument();
}

// ---------------------------------------------------------------------------
// Status polling alarm
// ---------------------------------------------------------------------------

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name !== ALARM_STATUS_POLL) return;

  const { meetingId } = await getState();
  if (!meetingId) {
    chrome.alarms.clear(ALARM_STATUS_POLL);
    return;
  }

  try {
    const data = await apiGet(`/api/extension/status/${meetingId}`);
    if (data.status === 'completed' || data.status === 'failed') {
      chrome.alarms.clear(ALARM_STATUS_POLL);
      await setState({ status: data.status, processingUrl: data.meetingUrl });
      notifyPopup({ status: data.status, processingUrl: data.meetingUrl });
    }
  } catch (err) {
    console.error('[background] Status poll error:', err);
  }
});

// ---------------------------------------------------------------------------
// Message handler
// ---------------------------------------------------------------------------

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  // Messages from popup
  if (message.type === 'START_RECORDING') {
    startRecording(message).then(sendResponse);
    return true; // async
  }

  if (message.type === 'STOP_RECORDING') {
    stopRecording().then(sendResponse);
    return true;
  }

  if (message.type === 'GET_STATE') {
    getState().then(sendResponse);
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

  // Message from content-script-app.js (token relay from web app)
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

  // Content script: user clicked "Record" in the in-page prompt
  if (message.type === 'AUTO_START_RECORDING') {
    const tabId = _sender.tab?.id;
    const meetingUrl = message.meetingUrl;
    (async () => {
      const { lastSourceLanguage } = await chrome.storage.local.get('lastSourceLanguage');
      const result = await startRecording({
        tabId,
        sourceLanguage: lastSourceLanguage || 'auto',
        meetingUrl,
      });
      chrome.tabs.sendMessage(tabId, {
        type: result.error ? 'AUTO_START_FAILED' : 'RECORDING_STARTED_FROM_PROMPT',
        error: result.error,
      }).catch(() => {});
      sendResponse(result);
    })();
    return true;
  }

  // Content script: meeting call ended (user left the call)
  if (message.type === 'MEETING_ENDED') {
    getState().then((state) => {
      if (state.isRecording) {
        console.log('[background] Meeting ended signal — stopping recording');
        stopRecording();
      }
    });
    return false;
  }

  // Messages from offscreen document
  if (message.type === 'UPLOAD_COMPLETE') {
    handleUploadComplete(message).then(() => sendResponse({ success: true }));
    return true;
  }

  if (message.type === 'UPLOAD_FAILED') {
    handleUploadFailed(message).then(() => sendResponse({ success: true }));
    return true;
  }

  // Legacy — keep for backwards compat during reload transition
  if (message.type === 'RECORDING_ERROR') {
    handleUploadFailed(message).then(() => sendResponse({ success: true }));
    return true;
  }
});

// ---------------------------------------------------------------------------
// Tab close — auto-stop recording if the meeting tab closes
// ---------------------------------------------------------------------------

chrome.tabs.onRemoved.addListener(async (tabId) => {
  const state = await getState();
  if (state.isRecording && state.tabId === tabId) {
    console.log('[background] Meeting tab closed — stopping recording');
    await stopRecording();
  }
});

// ---------------------------------------------------------------------------
// Badge — show a dot on the extension icon when on a meeting page (not recording)
// ---------------------------------------------------------------------------

const MEETING_URL_RE = /meet\.google\.com\/[a-z]|zoom\.us\/(j|wc)\/|app\.zoom\.us|teams\.(microsoft|live)\.com/;

async function updateBadgeForTab(tabId, url) {
  if (!url) return;
  const state = await getState();
  if (state.isRecording) return; // don't override recording badge

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

chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.url) updateBadgeForTab(tabId, changeInfo.url);
});
