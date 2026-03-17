/**
 * Shared transactional email utility using Resend.
 * All emails in the app go through this module.
 *
 * Required env vars:
 *   RESEND_API_KEY  — from resend.com dashboard
 *   FROM_EMAIL      — e.g. hello@trybasha.in
 *   NEXT_PUBLIC_APP_URL — e.g. https://trybasha.in
 */

import { Resend } from 'resend';
import type { MeetingSummary } from '@/lib/ai/summarize';

function getResend() {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error('RESEND_API_KEY is not set');
  return new Resend(key);
}

function getFrom() {
  return process.env.FROM_EMAIL ?? 'hello@trybasha.in';
}

// ── Password Reset ────────────────────────────────────────────────────────────

export async function sendPasswordResetEmail(to: string, resetUrl: string): Promise<void> {
  const resend = getResend();
  await resend.emails.send({
    from: `Basha <${getFrom()}>`,
    to,
    subject: 'Reset your Basha password',
    html: `
<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#07071a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#07071a;padding:40px 0;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#0f0f2a;border:1px solid rgba(255,255,255,0.08);border-radius:16px;padding:40px;">
        <tr><td>
          <p style="margin:0 0 8px;font-size:13px;font-weight:700;color:#f59e0b;text-transform:uppercase;letter-spacing:0.1em;">Basha</p>
          <h1 style="margin:0 0 16px;font-size:22px;font-weight:700;color:rgba(255,255,255,0.92);">Reset your password</h1>
          <p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:rgba(255,255,255,0.5);">
            We received a request to reset your password. Click the button below to set a new one.
            This link expires in <strong style="color:rgba(255,255,255,0.75);">1 hour</strong>.
          </p>
          <a href="${resetUrl}" style="display:inline-block;background:#f59e0b;color:#07071a;font-size:15px;font-weight:700;text-decoration:none;padding:14px 28px;border-radius:10px;">
            Reset password →
          </a>
          <p style="margin:24px 0 0;font-size:13px;color:rgba(255,255,255,0.3);">
            If you didn't request this, you can safely ignore this email.
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`,
  });
}

// ── Transcript Ready ──────────────────────────────────────────────────────────

export async function sendTranscriptReadyEmail(
  to: string,
  name: string,
  meetingTitle: string,
  summary: MeetingSummary,
  meetingUrl: string
): Promise<void> {
  const resend = getResend();

  const firstName = name?.split(' ')[0] ?? 'there';

  function bullets(items: string[]): string {
    if (!items?.length) return '<p style="color:rgba(255,255,255,0.4);font-size:14px;margin:4px 0 0;">None recorded</p>';
    return items.map(item =>
      `<p style="margin:6px 0;font-size:14px;color:rgba(255,255,255,0.7);line-height:1.5;">• ${item}</p>`
    ).join('');
  }

  const html = `
<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#07071a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#07071a;padding:40px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#0f0f2a;border:1px solid rgba(255,255,255,0.08);border-radius:16px;padding:40px;">
        <tr><td>
          <!-- Header -->
          <p style="margin:0 0 4px;font-size:12px;font-weight:700;color:#f59e0b;text-transform:uppercase;letter-spacing:0.1em;">Basha</p>
          <h1 style="margin:0 0 4px;font-size:20px;font-weight:700;color:rgba(255,255,255,0.92);">${meetingTitle}</h1>
          <p style="margin:0 0 28px;font-size:13px;color:rgba(255,255,255,0.35);">Your transcript is ready</p>

          <!-- Overview -->
          ${summary.overview ? `
          <p style="margin:0 0 24px;font-size:15px;line-height:1.7;color:rgba(255,255,255,0.6);">
            Hi ${firstName}, ${summary.overview}
          </p>` : `<p style="margin:0 0 24px;font-size:15px;color:rgba(255,255,255,0.6);">Hi ${firstName}, your meeting has been transcribed.</p>`}

          <!-- Topics -->
          <div style="margin-bottom:20px;padding:18px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.07);border-radius:10px;">
            <p style="margin:0 0 10px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;color:rgba(255,255,255,0.3);">Topics Discussed</p>
            ${bullets(summary.topics)}
          </div>

          <!-- Key Decisions -->
          <div style="margin-bottom:20px;padding:18px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.07);border-radius:10px;">
            <p style="margin:0 0 10px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;color:rgba(255,255,255,0.3);">Key Decisions</p>
            ${bullets(summary.decisions)}
          </div>

          <!-- Action Items -->
          <div style="margin-bottom:28px;padding:18px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.07);border-radius:10px;">
            <p style="margin:0 0 10px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;color:rgba(255,255,255,0.3);">Action Items / Notes</p>
            ${bullets(summary.notes)}
          </div>

          <!-- CTA -->
          <a href="${meetingUrl}" style="display:inline-block;background:#f59e0b;color:#07071a;font-size:15px;font-weight:700;text-decoration:none;padding:14px 28px;border-radius:10px;">
            View full transcript →
          </a>

          <p style="margin:28px 0 0;font-size:12px;color:rgba(255,255,255,0.2);">
            Basha — AI meeting notes for Indian professionals
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  await resend.emails.send({
    from: `Basha <${getFrom()}>`,
    to,
    subject: `Your Basha transcript is ready — ${meetingTitle}`,
    html,
  });
}

// ── Bot Failure ───────────────────────────────────────────────────────────────

export async function sendBotFailureEmail(
  to: string,
  name: string,
  meetingTitle: string,
  errorMsg: string
): Promise<void> {
  const resend = getResend();
  const firstName = name?.split(' ')[0] ?? 'there';
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? '';

  await resend.emails.send({
    from: `Basha <${getFrom()}>`,
    to,
    subject: `Basha couldn't join your meeting — ${meetingTitle}`,
    html: `
<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#07071a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#07071a;padding:40px 0;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#0f0f2a;border:1px solid rgba(255,255,255,0.08);border-radius:16px;padding:40px;">
        <tr><td>
          <p style="margin:0 0 8px;font-size:13px;font-weight:700;color:#f59e0b;text-transform:uppercase;letter-spacing:0.1em;">Basha</p>
          <h1 style="margin:0 0 16px;font-size:22px;font-weight:700;color:rgba(255,255,255,0.92);">Meeting recording failed</h1>
          <p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:rgba(255,255,255,0.5);">
            Hi ${firstName}, the Basha bot couldn't record <strong style="color:rgba(255,255,255,0.75);">${meetingTitle}</strong>.
          </p>
          <div style="margin-bottom:24px;padding:14px;background:rgba(251,113,133,0.07);border:1px solid rgba(251,113,133,0.15);border-radius:8px;">
            <p style="margin:0;font-size:13px;color:rgba(251,113,133,0.8);">Error: ${errorMsg}</p>
          </div>
          <p style="margin:0 0 24px;font-size:14px;line-height:1.6;color:rgba(255,255,255,0.4);">
            This can happen if the meeting host hasn't allowed bots, or the meeting ended before the bot could join.
            You can try again from your dashboard or use the Chrome extension for bot-free recording.
          </p>
          <a href="${appUrl}/dashboard" style="display:inline-block;background:rgba(245,158,11,0.15);color:#f59e0b;font-size:14px;font-weight:700;text-decoration:none;padding:12px 24px;border-radius:10px;border:1px solid rgba(245,158,11,0.3);">
            Go to dashboard →
          </a>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`,
  });
}
