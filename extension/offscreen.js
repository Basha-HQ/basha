/**
 * Basha Chrome Extension — Offscreen Document (offscreen.js)
 *
 * Captures BOTH tab audio (other participants) AND microphone (the user),
 * mixes them via Web Audio API, and records as a single WebM/Opus stream.
 *
 * Audio model: "accumulate and process once"
 *   - Raw WebM chunks are uploaded to /api/extension/upload-chunk as they are
 *     recorded (every 30s) for server-side storage only — no per-chunk STT.
 *   - On recording stop, the final chunk is sent with isFinal=true.
 *   - The server reassembles the full audio and runs the AI pipeline once,
 *     giving proper meeting-level diarization and no looping artefacts.
 *
 * Chunk layout:
 *   chunk 0 — WebM EBML header + first cluster (init segment)
 *   chunk 1+ — raw cluster data (no EBML header)
 *   server concat(chunk0, chunk1, ..., chunkN) = valid WebM file
 */

let mediaRecorder = null;
let chunks = [];
let activeMeetingId = null;
let recordingStartTime = null;
let audioContext = null;
let uploadCredentials = null; // { token, origin }
let tabPlayback = null; // Audio element for tab audio playback (bypasses Web Audio resampling)

let chunkIndex = 0;          // monotonically increasing sequence number
let flushInterval = null;     // setInterval handle for periodic flushing
let isFlushingChunk = false;  // prevents overlapping flushes

// Each 30-second chunk of WebM/Opus is ~300 KB — well under Vercel's 4.5 MB body limit.
const CHUNK_FLUSH_INTERVAL_MS = 30_000;

// Minimum blob size to consider audio meaningful (not just WebM framing overhead).
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
 * Upload one raw WebM chunk to /api/extension/upload-chunk.
 * chunk 0 contains the EBML header; subsequent chunks are raw cluster data.
 * The server stores all chunks and reassembles on isFinal=true.
 */
async function uploadChunk(blob, idx, isFinal, creds, meetingId, duration) {
  const formData = new FormData();
  formData.append('audio', blob, `${meetingId}_chunk${idx}.webm`);
  formData.append('meetingId', meetingId);
  formData.append('chunkIndex', String(idx));
  formData.append('isFinal', String(isFinal));
  if (isFinal && duration != null) formData.append('duration', String(duration));

  return fetch(`${creds.origin}/api/extension/upload-chunk`, {
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

  // 3. Mix streams via Web Audio API
  audioContext = new AudioContext();
  const destination = audioContext.createMediaStreamDestination();

  // Play tab audio directly via Audio element — avoids Web Audio resampling artifacts
  // that cause muffling when AudioContext sample rate differs from the stream's rate.
  tabPlayback = new Audio();
  tabPlayback.srcObject = tabStream;
  tabPlayback.play().catch(() => {});

  const tabSource = audioContext.createMediaStreamSource(tabStream);
  tabSource.connect(destination); // for recording only

  if (micStream) {
    const micSource = audioContext.createMediaStreamSource(micStream);
    micSource.connect(destination);
  }

  const recordingStream = destination.stream;

  // Prefer opus codec for best Sarvam STT compatibility and small file size
  const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
    ? 'audio/webm;codecs=opus'
    : 'audio/webm';

  mediaRecorder = new MediaRecorder(recordingStream, { mimeType, audioBitsPerSecond: 128_000 });

  mediaRecorder.ondataavailable = (event) => {
    if (event.data && event.data.size > 0) {
      chunks.push(event.data);
    }
  };

  // Keep references for cleanup
  const allStreams = [tabStream, micStream].filter(Boolean);

  mediaRecorder.onstop = async () => {
    // Stop periodic flush before processing the final chunk
    clearInterval(flushInterval);
    flushInterval = null;
    isFlushingChunk = false;

    const remainingBlob = new Blob(chunks, { type: mimeType });
    const totalDuration = Math.round((Date.now() - recordingStartTime) / 1000);
    const capturedMeetingId = activeMeetingId;
    const creds = uploadCredentials;
    const capturedChunkIndex = chunkIndex;

    // Stop all tracks to release microphone/tab audio
    allStreams.forEach((s) => s.getTracks().forEach((t) => t.stop()));
    if (tabPlayback) { tabPlayback.pause(); tabPlayback.srcObject = null; tabPlayback = null; }
    if (audioContext) {
      audioContext.close().catch(() => {});
      audioContext = null;
    }
    mediaRecorder = null;
    chunks = [];
    activeMeetingId = null;
    uploadCredentials = null;
    chunkIndex = 0;

    // If no prior chunks were flushed AND the recording blob is empty, abort
    if (capturedChunkIndex === 0 && remainingBlob.size < MIN_VALID_BLOB_SIZE) {
      chrome.runtime.sendMessage({
        type: 'UPLOAD_FAILED',
        meetingId: capturedMeetingId,
        error: `Recording is empty (${Math.round(remainingBlob.size / 1024)} KB). No audio was captured — check that meeting audio is playing and microphone permission is granted.`,
      });
      return;
    }

    // Upload remaining audio as the final chunk.
    // If capturedChunkIndex === 0: remainingBlob is the complete recording (init + all data).
    // If capturedChunkIndex > 0:  remainingBlob is raw cluster data only (init already sent as chunk 0).
    // Either way, send as-is — the server will concatenate in order.
    try {
      const res = await uploadChunk(
        remainingBlob,
        capturedChunkIndex,
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

  // Flush raw chunks every 30 seconds.
  // chunk 0 is the WebM init segment (EBML header + first cluster).
  // Subsequent chunks are raw cluster data — no init segment prepended.
  // The server stores all chunks and concatenates them in order when isFinal=true.
  flushInterval = setInterval(async () => {
    if (!chunks.length || !activeMeetingId || isFlushingChunk) return;
    isFlushingChunk = true;

    const pendingData = chunks.splice(0);
    const blob = new Blob(pendingData, { type: mimeType });

    if (blob.size < MIN_VALID_BLOB_SIZE) {
      // Near-silence — skip upload but keep accumulating
      isFlushingChunk = false;
      return;
    }

    const idx = chunkIndex++;

    try {
      const res = await uploadChunk(blob, idx, false, uploadCredentials, activeMeetingId, null);
      if (!res.ok) {
        const text = await res.text().catch(() => res.status.toString());
        console.error(`[offscreen] Chunk ${idx} upload failed (${res.status}): ${text}`);
      } else {
        console.log(`[offscreen] Chunk ${idx} stored (${Math.round(blob.size / 1024)} KB)`);
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
