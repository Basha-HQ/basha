/**
 * Basha — injected-rtc.js
 *
 * Runs in the PAGE context (not the content-script sandbox) so it can access
 * window.RTCPeerConnection directly.
 *
 * Injected by content-script.js via a <script src="..."> tag pointing to the
 * extension's web-accessible resource URL.
 *
 * What it does:
 *  1. Hooks RTCPeerConnection at creation so we hold references to all connections
 *     Google Meet opens (one per remote participant's audio/video stream).
 *  2. Polls getStats() every 500 ms to find the loudest inbound audio track.
 *  3. Posts a BASHA_RTC_SPEAKERS message to window for the content script to receive.
 *
 * The content script correlates trackId → participant name by matching the track
 * against the srcObject of each participant's <video> element in the DOM.
 */

(function () {
  // Guard against double-injection (e.g. SPA navigation reinjects the script)
  if (window.__bashaRTCHooked) return;
  window.__bashaRTCHooked = true;
  window.__bashaConnections = window.__bashaConnections || [];

  // ── Hook RTCPeerConnection ────────────────────────────────────────────────

  const OrigPC = window.RTCPeerConnection;
  if (!OrigPC) return; // not a WebRTC page

  function BashaRTCPeerConnection(...args) {
    const pc = new OrigPC(...args);
    window.__bashaConnections.push(pc);
    // Clean up closed connections to avoid memory leaks
    pc.addEventListener('connectionstatechange', () => {
      if (pc.connectionState === 'closed' || pc.connectionState === 'failed') {
        window.__bashaConnections = window.__bashaConnections.filter((c) => c !== pc);
      }
    });
    return pc;
  }

  // Preserve prototype chain and static properties so Meet's duck-typing checks pass
  BashaRTCPeerConnection.prototype = OrigPC.prototype;
  Object.setPrototypeOf(BashaRTCPeerConnection, OrigPC);
  // Copy static properties (e.g. RTCPeerConnection.generateCertificate)
  Object.getOwnPropertyNames(OrigPC).forEach((key) => {
    if (key === 'prototype' || key === 'length' || key === 'name') return;
    try {
      BashaRTCPeerConnection[key] = OrigPC[key];
    } catch (_) {}
  });

  window.RTCPeerConnection = BashaRTCPeerConnection;

  // ── Poll getStats every 500 ms ────────────────────────────────────────────

  setInterval(async () => {
    const connections = window.__bashaConnections;
    if (!connections || connections.length === 0) return;

    const speakers = [];

    for (const pc of connections) {
      if (pc.connectionState === 'closed' || pc.connectionState === 'failed') continue;
      try {
        const stats = await pc.getStats();
        stats.forEach((stat) => {
          // inbound-rtp: remote participants
          if (stat.type === 'inbound-rtp' && stat.kind === 'audio' && stat.audioLevel > 0.01) {
            speakers.push({
              trackId: stat.trackIdentifier,
              ssrc: stat.ssrc,
              audioLevel: stat.audioLevel,
              isLocal: false,
            });
          }
          // outbound-rtp: local user's microphone.
          // audioLevel is not in outbound-rtp stats directly — use media-source instead.
        });

        // Local mic level lives in the 'media-source' stat (type='media-source', kind='audio')
        // linked to the outbound-rtp track via stat.trackIdentifier.
        stats.forEach((stat) => {
          if (stat.type === 'media-source' && stat.kind === 'audio' && (stat.audioLevel ?? 0) > 0.01) {
            // Find the matching outbound-rtp to get the trackIdentifier
            let trackId = stat.trackIdentifier ?? stat.id;
            // Also try finding via outbound-rtp that references this source
            stats.forEach((s) => {
              if (s.type === 'outbound-rtp' && s.kind === 'audio' && s.mediaSourceId === stat.id) {
                trackId = s.trackIdentifier ?? trackId;
              }
            });
            speakers.push({
              trackId,
              ssrc: null,
              audioLevel: stat.audioLevel,
              isLocal: true,
            });
          }
        });
      } catch (_) {
        // Connection may have closed between check and getStats() — ignore
      }
    }

    if (speakers.length > 0) {
      window.postMessage(
        { type: 'BASHA_RTC_SPEAKERS', speakers, timestampMs: Date.now() },
        '*'
      );
    }
  }, 500);
})();
