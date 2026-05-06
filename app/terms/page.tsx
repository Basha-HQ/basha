export const metadata = {
  title: 'Terms of Service — Basha',
  description: 'Terms of Service for Basha, the AI meeting notetaker for Indian teams.',
};

export default function TermsPage() {
  return (
    <main className="max-w-3xl mx-auto px-6 py-16 text-gray-800">
      <h1 className="text-3xl font-bold mb-2">Terms of Service</h1>
      <p className="text-sm text-gray-500 mb-10">Effective date: May 6, 2026</p>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-3">1. Acceptance of Terms</h2>
        <p>
          By accessing or using Basha (&ldquo;the Service&rdquo;) at{' '}
          <a href="https://trybasha.in" className="text-indigo-600 underline">
            trybasha.in
          </a>{' '}
          or via the Basha Chrome extension, you agree to be bound by these Terms of Service. If
          you do not agree, do not use the Service.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-3">2. Description of Service</h2>
        <p>
          Basha is an AI-powered meeting transcription and summarization tool built for Indian
          teams. It records meeting audio via a Chrome extension or manual upload, transcribes and
          translates the audio using Sarvam AI, and generates structured summaries using an AI
          language model.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-3">3. Account Registration</h2>
        <p>
          You must create an account to use the Service. You are responsible for maintaining the
          confidentiality of your credentials and for all activity that occurs under your account.
          You must provide accurate information during registration and keep it up to date. You must
          be at least 18 years old to use the Service.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-3">4. Acceptable Use</h2>
        <p className="mb-2">You agree not to:</p>
        <ul className="list-disc pl-5 space-y-2">
          <li>Record meetings without the knowledge and consent of all participants.</li>
          <li>
            Use the Service for any unlawful purpose or in violation of any applicable laws or
            regulations.
          </li>
          <li>
            Reverse-engineer, decompile, or attempt to extract the source code of the Service.
          </li>
          <li>Scrape, crawl, or systematically extract data from the Service.</li>
          <li>
            Attempt to gain unauthorized access to any part of the Service or its infrastructure.
          </li>
          <li>
            Upload or transmit content that is harmful, defamatory, obscene, or infringes the
            rights of any third party.
          </li>
        </ul>
        <p className="mt-3">
          You are solely responsible for obtaining all necessary consents from meeting participants
          before recording with Basha.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-3">5. Intellectual Property</h2>
        <p>
          You retain ownership of all content you record, transcribe, or upload through the
          Service. By using the Service, you grant us a limited, non-exclusive license to process
          your content solely to provide the transcription, translation, and summarization features.
        </p>
        <p className="mt-2">
          The Basha name, logo, website, and software are the intellectual property of Basha and
          may not be used without our prior written consent.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-3">6. Privacy</h2>
        <p>
          Your use of the Service is also governed by our{' '}
          <a href="/privacy" className="text-indigo-600 underline">
            Privacy Policy
          </a>
          , which is incorporated into these Terms by reference.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-3">7. Disclaimer of Warranties</h2>
        <p>
          The Service is provided &ldquo;as is&rdquo; and &ldquo;as available&rdquo; without
          warranties of any kind, express or implied, including but not limited to warranties of
          merchantability, fitness for a particular purpose, or non-infringement. We do not warrant
          that the Service will be uninterrupted, error-free, or that transcripts and summaries
          will be accurate.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-3">8. Limitation of Liability</h2>
        <p>
          To the fullest extent permitted by applicable law, Basha shall not be liable for any
          indirect, incidental, special, consequential, or punitive damages arising out of or
          related to your use of the Service, even if we have been advised of the possibility of
          such damages. Our total liability to you for any claim arising from these Terms or the
          Service shall not exceed the amount you paid us in the twelve months preceding the claim.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-3">9. Termination</h2>
        <p>
          We reserve the right to suspend or terminate your account at any time if you violate
          these Terms. You may delete your account at any time by contacting us at{' '}
          <a href="mailto:hello@trybasha.in" className="text-indigo-600 underline">
            hello@trybasha.in
          </a>
          . Upon termination, your right to use the Service ceases immediately.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-3">10. Changes to These Terms</h2>
        <p>
          We may update these Terms from time to time. When we do, we will revise the effective
          date at the top of this page. Continued use of the Service after changes constitutes
          acceptance of the revised Terms.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-3">11. Governing Law</h2>
        <p>
          These Terms are governed by and construed in accordance with the laws of India. Any
          disputes arising under these Terms shall be subject to the exclusive jurisdiction of the
          courts located in India.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-semibold mb-3">12. Contact</h2>
        <p>
          Questions about these Terms? Email us at{' '}
          <a href="mailto:hello@trybasha.in" className="text-indigo-600 underline">
            hello@trybasha.in
          </a>
          .
        </p>
      </section>
    </main>
  );
}
