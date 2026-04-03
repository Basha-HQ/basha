/**
 * Basha Chrome Extension — Offscreen Document (offscreen.js)
 *
 * Captures BOTH tab audio (other participants) AND microphone (the user),
 * mixes them via Web Audio API, and records as a single WebM/Opus stream.
 * Uploads the recorded audio directly to the server (avoids Chrome message size limits).
 */

let mediaRecorder = null;
let chunks = [];
let activeMeetingId = null;
let recordingStartTime = null;
let audioContext = null;
let uploadCredentials = null; // { token, origin }

// Minimum blob size (in bytes) to consider a recording valid.
// A near-empty WebM (just headers) is typically ~3-5 KB.
const MIN_VALID_BLOB_SIZE = 10_000; // 10 KB

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.target !== 'offscreen') return;

  if (message.type === 'START_RECORDING') {
    handleStartRecording(message).then(() => sendResponse({ success: true }));
    return true;
  }

  if (message.type === 'STOP_RECORDING') {
    handleStopRecording();
    sendResponse({ success: true });
  }
});

async function handleStartRecording({ streamId, meetingId, token, origin }) {
  if (mediaRecorder && mediaRecorder.state !== 'inactive') {
    return;
  }

  activeMeetingId = meetingId;
  uploadCredentials = { token, origin };
  chunks = [];
  recordingStartTime = Date.now();

  // 1. Capture tab audio (other participants' voices, meeting sounds)
  let tabStream;
  try {
    tabStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        mandatory: {
          chromeMediaSource: 'tab',
          chromeMediaSourceId: streamId,
        },
      },
      video: false,
    });
  } catch (err) {
    chrome.runtime.sendMessage({
      type: 'RECORDING_ERROR',
      error: `Could not capture tab audio: ${err.message}`,
    });
    return;
  }

  // 2. Capture microphone (the user's voice)
  let micStream = null;
  try {
    micStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
      video: false,
    });
  } catch {
    // Microphone access denied — record tab audio only
  }

  // 3. Mix streams via Web Audio API (always use AudioContext for consistent output)
  audioContext = new AudioContext();
  const destination = audioContext.createMediaStreamDestination();

  const tabSource = audioContext.createMediaStreamSource(tabStream);
  tabSource.connect(destination);           // for recording
  tabSource.connect(audioContext.destination); // route back to speakers so user can still hear

  if (micStream) {
    const micSource = audioContext.createMediaStreamSource(micStream);
    micSource.connect(destination);
  }

  const recordingStream = destination.stream;

  // Prefer opus codec for best Sarvam STT compatibility and small file size
  const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
    ? 'audio/webm;codecs=opus'
    : 'audio/webm';

  mediaRecorder = new MediaRecorder(recordingStream, { mimeType });

  mediaRecorder.ondataavailable = (event) => {
    if (event.data && event.data.size > 0) {
      chunks.push(event.data);
    }
  };

  // Keep references for cleanup
  const allStreams = [tabStream, micStream].filter(Boolean);

  mediaRecorder.onstop = async () => {
    const blob = new Blob(chunks, { type: mimeType });
    const duration = Math.round((Date.now() - recordingStartTime) / 1000);
    const capturedMeetingId = activeMeetingId;
    const creds = uploadCredentials;

    // Stop all tracks to release microphone/tab audio
    allStreams.forEach((s) => s.getTracks().forEach((t) => t.stop()));
    if (audioContext) {
      audioContext.close().catch(() => {});
      audioContext = null;
    }
    mediaRecorder = null;
    chunks = [];
    activeMeetingId = null;
    uploadCredentials = null;

    // Check for empty/too-short recordings
    if (blob.size < MIN_VALID_BLOB_SIZE) {
      chrome.runtime.sendMessage({
        type: 'UPLOAD_FAILED',
        meetingId: capturedMeetingId,
        error: `Recording is empty (${Math.round(blob.size / 1024)} KB). No audio was captured — check that meeting audio is playing and microphone permission is granted.`,
      });
      return;
    }

    // Upload directly from offscreen (avoids Chrome message size limits)
    try {
      const formData = new FormData();
      formData.append('audio', blob, `${capturedMeetingId}.webm`);
      formData.append('meetingId', capturedMeetingId);
      if (duration) formData.append('duration', String(duration));

      const res = await fetch(`${creds.origin}/api/extension/upload`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${creds.token}` },
        body: formData,
      });

      if (!res.ok) {
        const text = await res.text().catch(() => res.status.toString());
        throw new Error(`Upload failed (${res.status}): ${text}`);
      }

      const data = await res.json();
      chrome.runtime.sendMessage({
        type: 'UPLOAD_COMPLETE',
        meetingId: capturedMeetingId,
        processingUrl: data.processingUrl,
      });
    } catch (err) {
      chrome.runtime.sendMessage({
        type: 'UPLOAD_FAILED',
        meetingId: capturedMeetingId,
        error: err.message,
      });
    }
  };

  // Collect data every 1 second for more granular chunks
  mediaRecorder.start(1000);
}

function handleStopRecording() {
  if (!mediaRecorder || mediaRecorder.state === 'inactive') {
    return;
  }
  mediaRecorder.stop();
}
