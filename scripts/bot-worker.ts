/**
 * Bot Worker — Recall.ai-inspired meeting bot.
 *
 * Runs as a standalone Node.js child process (spawned by /api/bots).
 * Lifecycle: idle → joining → in_meeting → recording → leaving → processing → completed
 *
 * Usage (internal, spawned by API):
 *   npx ts-node --project tsconfig.scripts.json scripts/bot-worker.ts <botId> <meetingUrl> <meetingId> <userId>
 *
 * Audio capture strategy:
 *   - Uses Web Audio API injection to hook into <audio> elements rendered by Google Meet
 *   - Each participant's audio stream is captured via element.captureStream()
 *   - Chunks are sent to Node.js via page.exposeFunction and assembled into a WebM file
 */

import path from 'path';
import fs from 'fs';
import { chromium, Page, BrowserContext } from 'playwright';
import { Pool } from 'pg';

// ── Args ──────────────────────────────────────────────────────────────────────
const [, , botId, meetingUrl, meetingId, userId] = process.argv;

if (!botId || !meetingUrl || !meetingId || !userId) {
  console.error('[bot-worker] Usage: bot-worker.ts <botId> <meetingUrl> <meetingId> <userId>');
  process.exit(1);
}

// ── DB ────────────────────────────────────────────────────────────────────────
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function dbQuery(sql: string, params: unknown[] = []) {
  const client = await pool.connect();
  try {
    return await client.query(sql, params);
  } finally {
    client.release();
  }
}

async function setBotStatus(status: string, extra: { error?: string; pid?: number } = {}) {
  const sets = ['status = $1', 'updated_at = NOW()'];
  const vals: unknown[] = [status];

  if (extra.pid != null) {
    vals.push(extra.pid);
    sets.push(`pid = $${vals.length}`);
  }
  if (extra.error != null) {
    vals.push(extra.error);
    sets.push(`error = $${vals.length}`);
  }

  vals.push(botId);
  await dbQuery(`UPDATE bots SET ${sets.join(', ')} WHERE id = $${vals.length}`, vals);
  console.log(`[bot] status → ${status}${extra.error ? ` (${extra.error})` : ''}`);
}

// ── Audio capture ─────────────────────────────────────────────────────────────
/**
 * Injects Web Audio capture into the page and returns a function that,
 * when called, stops recording and returns the combined WebM audio buffer.
 *
 * Strategy: hook into every <audio> element Google Meet creates for each
 * participant using element.captureStream(), feed into a MediaRecorder,
 * and pipe 5-second chunks back to Node.js via exposeFunction.
 */
async function injectAudioCapture(page: Page): Promise<() => Promise<Buffer>> {
  const chunks: Buffer[] = [];

  await page.exposeFunction('__lmSendChunk', (base64: string) => {
    chunks.push(Buffer.from(base64, 'base64'));
  });

  await page.evaluate(() => {
    const audioCtx = new AudioContext();
    const destination = audioCtx.createMediaStreamDestination();

    function hookElement(el: HTMLAudioElement) {
      if ((el as any).__lmHooked) return;
      (el as any).__lmHooked = true;
      try {
        // captureStream() is safe to call multiple times unlike createMediaElementSource
        const stream = (el as any).captureStream?.() as MediaStream | undefined;
        if (!stream) return;
        const src = audioCtx.createMediaStreamSource(stream);
        src.connect(destination);
      } catch {
        /* ignore — some elements may be cross-origin or already released */
      }
    }

    // Hook existing and future <audio> elements
    document.querySelectorAll('audio').forEach(el => hookElement(el as HTMLAudioElement));
    const observer = new MutationObserver(() => {
      document.querySelectorAll('audio').forEach(el => hookElement(el as HTMLAudioElement));
    });
    observer.observe(document.body, { childList: true, subtree: true });

    // Start recording in 5-second chunks
    const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
      ? 'audio/webm;codecs=opus'
      : 'audio/webm';

    const recorder = new MediaRecorder(destination.stream, { mimeType });
    recorder.ondataavailable = async (e) => {
      if (e.data.size === 0) return;
      const ab = await e.data.arrayBuffer();
      const b64 = btoa(String.fromCharCode(...new Uint8Array(ab)));
      (window as any).__lmSendChunk(b64);
    };
    recorder.start(5000);

    (window as any).__lmStopRecording = () => {
      recorder.requestData(); // flush last chunk
      recorder.stop();
    };
  });

  return async (): Promise<Buffer> => {
    await page.evaluate(() => (window as any).__lmStopRecording?.()).catch(() => {});
    await new Promise(r => setTimeout(r, 1500)); // wait for last chunk flush

    const total = chunks.reduce((n, c) => n + c.length, 0);
    const combined = Buffer.concat(chunks, total);
    console.log(`[bot] Audio captured: ${(combined.length / 1024 / 1024).toFixed(2)} MB`);
    return combined;
  };
}

// ── Google Meet joining ───────────────────────────────────────────────────────
async function joinGoogleMeet(page: Page, context: BrowserContext) {
  console.log('[bot] Navigating to:', meetingUrl);
  await page.goto(meetingUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(3000);

  // Enter name if prompted (guest join without Google account)
  const nameInput = page.locator(
    'input[placeholder*="name" i], input[aria-label*="name" i]'
  ).first();
  if (await nameInput.isVisible({ timeout: 5000 }).catch(() => false)) {
    await nameInput.fill('LinguaMeet Bot');
    console.log('[bot] Filled name field');
  }

  // Dismiss any permission prompts
  for (const text of ['Got it', 'Dismiss', 'Close']) {
    const btn = page.locator(`button:has-text("${text}")`).first();
    if (await btn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await btn.click().catch(() => {});
    }
  }

  // Click the join button (Google Meet uses different labels)
  const joinSelector = [
    'button:has-text("Join now")',
    'button:has-text("Ask to join")',
    'button:has-text("Join")',
  ].join(', ');

  const joinBtn = page.locator(joinSelector).first();
  await joinBtn.waitFor({ state: 'visible', timeout: 30000 });
  console.log('[bot] Clicking join button');
  await joinBtn.click();

  // Wait to be admitted or to land inside the meeting
  await page.waitForTimeout(6000);
  console.log('[bot] Join action complete (may still be in waiting room)');
}

// ── Meeting end detection ─────────────────────────────────────────────────────
async function waitForMeetingEnd(page: Page, maxMs = 3_600_000) {
  const deadline = Date.now() + maxMs;
  console.log('[bot] Waiting for meeting to end…');

  while (Date.now() < deadline) {
    const ended = await page
      .locator("text=/you've left|left the meeting|return to home/i")
      .first()
      .isVisible({ timeout: 1000 })
      .catch(() => false);

    if (ended) {
      console.log('[bot] Meeting ended (detected end screen)');
      return;
    }

    // Also check if page URL changed away from meet.google.com
    const url = page.url();
    if (!url.includes('meet.google.com')) {
      console.log('[bot] Navigated away from meeting:', url);
      return;
    }

    await page.waitForTimeout(10_000);
  }

  console.log('[bot] Max duration reached, stopping recording');
}

// ── AI processing (inline, no HTTP needed) ───────────────────────────────────
async function runAIPipeline(audioBuffer: Buffer, audioPath: string) {
  // Dynamic imports so ts-node resolves them correctly relative to project root
  const { transcribeAudio, translateToEnglish, splitIntoSegments } = await import(
    '../lib/ai/sarvam'
  );
  const { generateSummary } = await import('../lib/ai/summarize');

  const meetingRow = await dbQuery(
    'SELECT title FROM meetings WHERE id = $1',
    [meetingId]
  );
  const meetingTitle = meetingRow.rows[0]?.title ?? 'Meeting';

  console.log('[bot] Transcribing with Sarvam AI…');
  const sttResult = await transcribeAudio(audioBuffer, path.basename(audioPath));

  const segments = sttResult.segments?.length
    ? sttResult.segments.map(s => ({
        text: s.transcript,
        startSeconds: Math.round(s.start),
      }))
    : splitIntoSegments(sttResult.transcript, 0);

  console.log(`[bot] Got ${segments.length} segments, translating…`);
  const englishSegments: string[] = [];

  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    const en = await translateToEnglish(seg.text, sttResult.language_code ?? 'auto');
    englishSegments.push(en);
    await dbQuery(
      `INSERT INTO transcripts (meeting_id, segment_index, timestamp_seconds, original_text, english_text)
       VALUES ($1, $2, $3, $4, $5)`,
      [meetingId, i, seg.startSeconds, seg.text, en]
    );
  }

  console.log('[bot] Generating summary…');
  const summary = await generateSummary(englishSegments.join(' '), meetingTitle);

  await dbQuery(
    `UPDATE meetings SET status = 'completed', summary = $1, completed_at = NOW() WHERE id = $2`,
    [JSON.stringify(summary), meetingId]
  );

  console.log('[bot] AI pipeline complete');
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log(`[bot] Starting — botId=${botId} meetingId=${meetingId}`);
  await setBotStatus('joining', { pid: process.pid });

  const uploadDir = process.env.UPLOAD_DIR ?? './public/uploads';
  let browser;

  try {
    browser = await chromium.launch({
      headless: false, // Headed for local testing — see the bot join the call
      args: [
        '--use-fake-ui-for-media-stream', // Auto-dismiss mic/camera prompts
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-blink-features=AutomationControlled', // Reduce bot detection
      ],
    });

    const context = await browser.newContext({
      permissions: ['microphone', 'camera'],
      userAgent:
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
        '(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    });

    const page = await context.newPage();

    // Join the meeting
    await joinGoogleMeet(page, context);
    await setBotStatus('in_meeting');

    // Start audio recording
    await setBotStatus('recording');
    const stopRecording = await injectAudioCapture(page);

    // Wait for meeting to end
    await waitForMeetingEnd(page);

    // Collect audio
    await setBotStatus('leaving');
    const audioBuffer = await stopRecording();
    await browser.close();
    browser = undefined;

    if (audioBuffer.length < 1024) {
      console.warn('[bot] Audio too small — skipping processing');
      await setBotStatus('failed', { error: 'No audio captured' });
      return;
    }

    // Save audio file
    const dir = path.join(process.cwd(), uploadDir, userId);
    fs.mkdirSync(dir, { recursive: true });
    const audioPath = path.join(dir, `${meetingId}.webm`);
    fs.writeFileSync(audioPath, audioBuffer);
    console.log('[bot] Saved audio to', audioPath);

    await dbQuery(
      `UPDATE meetings SET audio_path = $1, status = 'processing' WHERE id = $2`,
      [audioPath, meetingId]
    );

    // Run AI pipeline directly (no HTTP — avoids auth issues)
    await setBotStatus('processing');
    await runAIPipeline(audioBuffer, audioPath);

    await setBotStatus('completed');
    console.log('[bot] All done!');
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[bot] Fatal error:', msg);
    await setBotStatus('failed', { error: msg }).catch(() => {});
    await dbQuery(
      `UPDATE meetings SET status = 'failed' WHERE id = $1`,
      [meetingId]
    ).catch(() => {});
  } finally {
    if (browser) await browser.close().catch(() => {});
    await pool.end().catch(() => {});
  }
}

main();
