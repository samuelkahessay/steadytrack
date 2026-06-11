import LegalLayout from '@/components/legal/LegalLayout';
import { CONTACT_EMAIL } from '@/lib/constants';

export const metadata = {
  title: 'Terms - SteadyTrack',
  description: 'Terms for the SteadyTrack local archive',
};

export default function TermsPage() {
  return (
    <LegalLayout title="Terms" lastUpdated="June 11, 2026">
      <div className="prose prose-gray max-w-none">
        <section className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">1. Archive Use</h2>
          <p className="text-gray-700 leading-relaxed mb-4">
            SteadyTrack is provided as an archived educational software project. You
            may run it locally, inspect the implementation, and adapt it under the
            repository license.
          </p>
          <p className="text-gray-700 leading-relaxed">
            The original live service is retired and not maintained as a hosted
            product.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">2. No Warranty</h2>
          <p className="text-gray-700 leading-relaxed">
            The archive is provided as-is. Curriculum data, links, study suggestions,
            and generated cards may be incomplete or outdated. Verify important
            academic information against official Alberta Education sources.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">3. Local Data</h2>
          <p className="text-gray-700 leading-relaxed">
            Data created in the default archive stays in your browser localStorage and
            local SQLite file. If you clear browser data or delete the local database,
            that local data may be lost.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">4. External Links</h2>
          <p className="text-gray-700 leading-relaxed">
            The app links to third-party educational resources. Those sites are not
            controlled by this archive and may change or disappear.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-bold text-gray-900 mb-4">5. Contact</h2>
          <p className="text-gray-700 leading-relaxed">
            Questions can be sent to{' '}
            <a href={`mailto:${CONTACT_EMAIL}`} className="text-blue-600 hover:text-blue-700">
              {CONTACT_EMAIL}
            </a>.
          </p>
        </section>
      </div>
    </LegalLayout>
  );
}
