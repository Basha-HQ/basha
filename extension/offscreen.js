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

// Chunked upload state
let chunkIndex = 0;          // monotonically increasing index sent with each chunk
let chunkStartSeconds = 0;   // timestamp offset for the current chunk window
let flushInterval = null;     // setInterval handle for periodic flushing
let isFlushingChunk = false;  // prevents overlapping flushes
let initSegment = null;       // WebM init segment (first flush) — prepended to all subsequent chunks so each is a valid standalone file

// Each 30-second chunk of WebM/Opus is ~300 KB — well under Vercel's 4.5 MB body limit.
// This enables unlimited meeting length: we upload and transcribe incrementally.
const CHUNK_FLUSH_INTERVAL_MS = 30_000;

// Minimum blob size (in bytes) to consider audio meaningful (not just WebM headers).
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

/**
 * Upload a single audio chunk to /api/extension/chunk.
 * @param {Blob} blob        — the audio data for this chunk
 * @param {number} idx       — chunk sequence number (0-based)
 * @param {number} startSec  — seconds elapsed since recording start (timestamp offset)
 * @param {boolean} isFinal  — true on the last chunk to trigger summary + completion
 * @param {{ token: string, origin: string }} creds
 * @param {string} meetingId
 * @param {number|null} duration — total meeting duration (seconds), only on final chunk
 */
async function uploadChunk(blob, idx, startSec, isFinal, creds, meetingId, duration) {
  const formData = new FormData();
  formData.append('audio', blob, `${meetingId}_chunk${idx}.webm`);
  formData.append('meetingId', meetingId);
  formData.append('chunkIndex', String(idx));
  formData.append('chunkStartSeconds', String(startSec));
  formData.append('isFinal', String(isFinal));
  if (isFinal && duration != null) formData.append('duration', String(duration));

  return fetch(`${creds.origin}/api/extension/chunk`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${creds.token}` },
    body: formData,
  });
}

async function handleStartRecording({ streamId, meetingId, token, origin }) {
  if (mediaRecorder && mediaRecorder.state !== 'inactive') {
    return;
  }

  activeMeetingId = meetingId;
  uploadCredentials = { token, origin };
  chunks = [];
  chunkIndex = 0;
  chunkStartSeconds = 0;
  initSegment = null;
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
    // Clear flush interval before processing final chunk
    clearInterval(flushInterval);
    flushInterval = null;
    isFlushingChunk = false;

    const remainingBlob = new Blob(chunks, { type: mimeType });
    const totalDuration = Math.round((Date.now() - recordingStartTime) / 1000);
    const capturedMeetingId = activeMeetingId;
    const creds = uploadCredentials;
    const capturedChunkIndex = chunkIndex;
    const capturedChunkStartSeconds = chunkStartSeconds;
    const capturedInitSegment = initSegment;

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
    chunkIndex = 0;
    chunkStartSeconds = 0;
    initSegment = null;

    // If no prior chunks flushed AND the recording is empty, abort
    if (capturedChunkIndex === 0 && remainingBlob.size < MIN_VALID_BLOB_SIZE) {
      chrome.runtime.sendMessage({
        type: 'UPLOAD_FAILED',
        meetingId: capturedMeetingId,
        error: `Recording is empty (${Math.round(remainingBlob.size / 1024)} KB). No audio was captured — check that meeting audio is playing and microphone permission is granted.`,
      });
      return;
    }

    // Upload remaining audio as the final chunk (triggers summary + completion on server)
    // Prepend init segment so the final chunk is also a valid standalone WebM file
    const finalBlob = capturedChunkIndex > 0 && capturedInitSegment
      ? new Blob([capturedInitSegment, remainingBlob], { type: mimeType })
      : remainingBlob;

    try {
      const res = await uploadChunk(
        finalBlob,
        capturedChunkIndex,
        capturedChunkStartSeconds,
        true, // isFinal
        creds,
        capturedMeetingId,
        totalDuration
      );

      if (!res.ok) {
        const text = await res.text().catch(() => res.status.toString());
        throw new Error(`Final chunk upload failed (${res.status}): ${text}`);
      }

      chrome.runtime.sendMessage({
        type: 'UPLOAD_COMPLETE',
        meetingId: capturedMeetingId,
        processingUrl: `/meetings/${capturedMeetingId}`,
      });
    } catch (err) {
      chrome.runtime.sendMessage({
        type: 'UPLOAD_FAILED',
        meetingId: capturedMeetingId,
        error: err.message,
      });
    }
  };

  // Collect data every 1 second for fine-grained chunk assembly
  mediaRecorder.start(1000);

  // Flush a chunk every 30 seconds during recording.
  // Each flush uploads ~300 KB of WebM/Opus and immediately starts transcription,
  // enabling unlimited meeting length without hitting Vercel's body size limit.
  flushInterval = setInterval(async () => {
    if (!chunks.length || !activeMeetingId || isFlushingChunk) return;
    isFlushingChunk = true;

    // Drain the current chunk buffer
    const pendingData = chunks.splice(0);
    const blob = new Blob(pendingData, { type: mimeType });

    if (blob.size < MIN_VALID_BLOB_SIZE) {
      // Near-silence — skip upload but keep accumulating
      isFlushingChunk = false;
      return;
    }

    const idx = chunkIndex++;
    const startSec = chunkStartSeconds;
    chunkStartSeconds = Math.round((Date.now() - recordingStartTime) / 1000);

    // First flush: save as init segment (contains WebM headers needed by all chunks)
    // Subsequent flushes: prepend init segment so each chunk is a valid standalone WebM file
    let uploadBlob = blob;
    if (idx === 0) {
      initSegment = blob;
    } else if (initSegment) {
      uploadBlob = new Blob([initSegment, blob], { type: mimeType });
    }

    try {
      const res = await uploadChunk(uploadBlob, idx, startSec, false, uploadCredentials, activeMeetingId, null);
      if (!res.ok) {
        const text = await res.text().catch(() => res.status.toString());
        console.error(`[offscreen] Chunk ${idx} upload failed (${res.status}): ${text}`);
      } else {
        console.log(`[offscreen] Chunk ${idx} uploaded (${Math.round(blob.size / 1024)} KB, start=${startSec}s)`);
      }
    } catch (err) {
      console.error(`[offscreen] Chunk ${idx} upload error:`, err.message);
    } finally {
      isFlushingChunk = false;
    }
  }, CHUNK_FLUSH_INTERVAL_MS);
}

function handleStopRecording() {
  if (!mediaRecorder || mediaRecorder.state === 'inactive') {
    return;
  }
  mediaRecorder.stop();
}
