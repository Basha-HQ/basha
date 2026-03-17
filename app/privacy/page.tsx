export const metadata = {
  title: 'Privacy Policy — Basha',
  description: 'Privacy Policy for Basha, the AI meeting notetaker for Indian teams.',
};

export default function PrivacyPage() {
  return (
    <main className="max-w-3xl mx-auto px-6 py-16 text-gray-800">
      <h1 className="text-3xl font-bold mb-2">Privacy Policy</h1>
      <p className="text-sm text-gray-500 mb-10">Effective date: March 17, 2026</p>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-3">1. Who We Are</h2>
        <p>
          Basha (&ldquo;we&rdquo;, &ldquo;our&rdquo;, &ldquo;us&rdquo;) is an AI-powered meeting transcription and
          summarization tool built for Indian teams. Our service is accessible at{' '}
          <a href="https://trybasha.in" className="text-indigo-600 underline">
            trybasha.in
          </a>{' '}
          and via our Chrome extension.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-3">2. What Data We Collect</h2>
        <ul className="list-disc pl-5 space-y-2">
          <li>
            <strong>Account information:</strong> Name and email address when you sign up via Google
            OAuth or email/password.
          </li>
          <li>
            <strong>Meeting audio:</strong> Audio recorded during your meetings via the Chrome
            extension or uploaded manually. Audio is captured only when you explicitly start
            recording.
          </li>
          <li>
            <strong>Transcripts and summaries:</strong> Text generated from your meeting audio,
            stored in your account for later review.
          </li>
          <li>
            <strong>Extension auth token:</strong> A secure token stored locally in the extension
            to authenticate API calls. We store only a hashed version server-side.
          </li>
        </ul>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-3">3. How We Use Your Data</h2>
        <ul className="list-disc pl-5 space-y-2">
          <li>
            <strong>Speech-to-text &amp; translation:</strong> Meeting audio is sent to{' '}
            <strong>Sarvam AI</strong> for transcription and translation into English or other
            Indian languages. Sarvam AI processes audio solely to return transcript text; they do
            not retain your audio.
          </li>
          <li>
            <strong>Meeting summaries:</strong> Transcripts are sent to{' '}
            <strong>OpenRouter</strong> (using an AI language model) to generate a structured
            summary of your meeting. OpenRouter processes text solely to return the summary.
          </li>
          <li>
            <strong>Service operation:</strong> We store transcripts and summaries in our database
            so you can access them later in your dashboard.
          </li>
        </ul>
        <p className="mt-3">
          We do not sell your data. We do not use your data to train AI models.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-3">4. Data Retention</h2>
        <p>
          Your meetings, transcripts, and summaries are retained as long as your account is active.
          You can delete individual meetings from your dashboard at any time. To delete your entire
          account and all associated data, contact us at{' '}
          <a href="mailto:hello@trybasha.in" className="text-indigo-600 underline">
            hello@trybasha.in
          </a>
          .
        </p>
        <p className="mt-2">
          Uploaded audio files are stored temporarily and deleted after processing is complete.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-3">5. Chrome Extension</h2>
        <p>
          The Basha Chrome extension captures tab audio (other meeting participants) and optionally
          your microphone to produce a complete meeting recording. Audio is captured only when you
          click <strong>Start Recording</strong> and stops when you click <strong>Stop</strong>.
          The extension does not run in the background or collect data outside of an active
          recording session.
        </p>
        <p className="mt-2">
          The extension communicates exclusively with <strong>trybasha.in</strong>. No audio or
          personal data is sent to any other domain.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-3">6. Third-Party Services</h2>
        <ul className="list-disc pl-5 space-y-2">
          <li>
            <strong>Sarvam AI</strong> — speech-to-text and translation for Indian languages
          </li>
          <li>
            <strong>OpenRouter</strong> — AI language model inference for meeting summaries
          </li>
          <li>
            <strong>Supabase / PostgreSQL</strong> — database hosting
          </li>
          <li>
            <strong>Vercel</strong> — application hosting
          </li>
          <li>
            <strong>Google OAuth</strong> — optional sign-in provider
          </li>
        </ul>
        <p className="mt-3">
          Each third-party service processes only the minimum data required to perform its function
          and is bound by its own privacy policy.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-3">7. Security</h2>
        <p>
          All data is transmitted over HTTPS. Auth tokens are stored as SHA-256 hashes server-side.
          We follow industry-standard practices to protect your data from unauthorized access.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-3">8. Your Rights</h2>
        <p>
          You may request access to, correction of, or deletion of your personal data at any time
          by emailing{' '}
          <a href="mailto:hello@trybasha.in" className="text-indigo-600 underline">
            hello@trybasha.in
          </a>
          . We will respond within 30 days.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-3">9. Changes to This Policy</h2>
        <p>
          We may update this policy from time to time. When we do, we will revise the effective
          date at the top of this page. Continued use of Basha after changes constitutes acceptance
          of the revised policy.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-semibold mb-3">10. Contact</h2>
        <p>
          Questions about this policy? Email us at{' '}
          <a href="mailto:hello@trybasha.in" className="text-indigo-600 underline">
            hello@trybasha.in
          </a>
          .
        </p>
      </section>
    </main>
  );
}
