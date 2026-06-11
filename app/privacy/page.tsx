import LegalLayout from '@/components/legal/LegalLayout';
import { CONTACT_EMAIL } from '@/lib/constants';

export const metadata = {
  title: 'Privacy Policy - SteadyTrack',
  description: 'Privacy notes for the SteadyTrack local archive',
};

export default function PrivacyPage() {
  return (
    <LegalLayout title="Privacy Policy" lastUpdated="June 11, 2026">
      <div className="prose prose-gray max-w-none">
        <section className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">1. Local Archive Status</h2>
          <p className="text-gray-700 leading-relaxed mb-4">
            SteadyTrack is a retired product preserved as a local-first public archive.
            The default open-source snapshot runs on your machine without accounts,
            hosted databases, analytics services, monitoring services, or private
            credentials.
          </p>
          <p className="text-gray-700 leading-relaxed">
            The original live service is no longer maintained. This page describes the
            default local archive behavior.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">2. Information Stored Locally</h2>
          <p className="text-gray-700 leading-relaxed mb-4">
            Study plans, progress, streaks, quick-check activity, settings, and
            infinite-learning state are stored in your browser&apos;s localStorage under
            keys prefixed with <code>steadytrack:v1:</code>.
          </p>
          <p className="text-gray-700 leading-relaxed">
            The app also creates a local SQLite database at
            <code> .local/steadytrack.sqlite</code> for public content cards,
            anonymous feedback, and contributor form submissions created during your
            local run.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">3. No Hosted Data Collection</h2>
          <p className="text-gray-700 leading-relaxed mb-4">
            The default archive does not send study data to SteadyTrack servers. It
            does not include analytics, monitoring, hosted database, hosted cache, or
            other cloud integrations.
          </p>
          <p className="text-gray-700 leading-relaxed">
            If you fork and deploy the archive publicly, you are responsible for your
            own privacy notice, hosting logs, rate limits, and any third-party services
            you add.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">4. External Resources</h2>
          <p className="text-gray-700 leading-relaxed">
            Curriculum resources may link to external educational sites such as
            YouTube, Khan Academy, or OpenStax. Those sites have their own privacy
            practices.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-bold text-gray-900 mb-4">5. Contact</h2>
          <p className="text-gray-700 leading-relaxed">
            Questions about this archive can be sent to{' '}
            <a href={`mailto:${CONTACT_EMAIL}`} className="text-blue-600 hover:text-blue-700">
              {CONTACT_EMAIL}
            </a>.
          </p>
        </section>
      </div>
    </LegalLayout>
  );
}
