/**
 * Basha Chrome Extension — App page content script (content-script-app.js)
 *
 * Injected into: https://trybasha.in/* and localhost:3000/*
 *
 * Responsibilities:
 *  1. Respond to BASHA_PING from the web app (extension detection)
 *  2. Relay BASHA_EXT_TOKEN from the web app to background.js (one-click connect)
 */

// Respond to extension detection ping
window.addEventListener('message', (event) => {
  // Only accept messages from same origin
  if (event.source !== window) return;

  if (event.data?.type === 'BASHA_PING') {
    window.postMessage(
      { type: 'BASHA_PONG', version: chrome.runtime.getManifest().version },
      window.location.origin
    );
  }

  if (event.data?.type === 'BASHA_EXT_TOKEN' && event.data.token) {
    chrome.runtime.sendMessage(
      {
        type: 'SET_EXTENSION_TOKEN',
        token: event.data.token,
        origin: window.location.origin,
      },
      (resp) => {
        // Notify the web page that the token was stored successfully
        window.postMessage(
          { type: 'BASHA_TOKEN_STORED', success: resp?.success ?? false },
          window.location.origin
        );
      }
    );
  }
});
