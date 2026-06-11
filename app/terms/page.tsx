/* eslint-disable react/no-unescaped-entities */
import LegalLayout from '@/components/legal/LegalLayout';
import { CONTACT_EMAIL } from '@/lib/constants';

export const metadata = {
  title: 'Terms of Service - SteadyTrack',
  description: 'Terms of Service for SteadyTrack - Read our user agreement',
};

export default function TermsPage() {
  return (
    <LegalLayout title="Terms of Service" lastUpdated="October 17, 2025">
      <div className="prose prose-gray max-w-none">
        <section className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            1. Acceptance of Terms
          </h2>
          <p className="text-gray-700 leading-relaxed mb-4">
            Welcome to SteadyTrack! By accessing or using SteadyTrack (the
            "Service"), you agree to be bound by these Terms of Service
            ("Terms"). If you do not agree to these Terms, do not use the
            Service.
          </p>
          <p className="text-gray-700 leading-relaxed">
            These Terms constitute a legally binding agreement between you and
            SteadyTrack ("we," "us," or "our"). We reserve the right to update
            these Terms at any time, and your continued use of the Service after
            changes are posted constitutes acceptance of the modified Terms.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            2. Description of Service
          </h2>
          <p className="text-gray-700 leading-relaxed mb-4">
            SteadyTrack is a free educational tracking platform designed to help
            Alberta high school students (grades 11 and 12) organize their study
            schedules for diploma exam preparation. The Service provides:
          </p>
          <ul className="list-disc pl-6 text-gray-700 space-y-2 mb-4">
            <li>
              Personalized study plans based on Alberta curriculum (Biology 20,
              Chemistry 20, Physics 20, Math 20-1)
            </li>
            <li>Progress tracking and completion tracking</li>
            <li>Study streak monitoring</li>
            <li>Optional parent dashboard access</li>
          </ul>
          <p className="text-gray-700 leading-relaxed font-semibold">
            Important Disclaimer:
          </p>
          <p className="text-gray-700 leading-relaxed">
            SteadyTrack is a supplementary educational tool and is NOT a
            replacement for formal education, teachers, or accredited courses. It
            is designed to help students stay organized during the Alberta teacher
            strike but does not guarantee academic success or diploma exam
            results.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            3. Eligibility
          </h2>

          <h3 className="text-xl font-semibold text-gray-900 mb-3">
            3.1 Age Requirements
          </h3>
          <p className="text-gray-700 leading-relaxed mb-4">
            You must be at least 13 years old to use SteadyTrack. If you are
            under 18, you should have parental consent before using the Service.
            By using SteadyTrack, you represent that you meet these age
            requirements.
          </p>

          <h3 className="text-xl font-semibold text-gray-900 mb-3">
            3.2 No Account Required
          </h3>
          <p className="text-gray-700 leading-relaxed mb-4">
            SteadyTrack does not require account creation, registration, or
            authentication. You can start using the Service immediately without
            providing any personal information.
          </p>

          <h3 className="text-xl font-semibold text-gray-900 mb-3">
            3.3 Data Responsibility
          </h3>
          <p className="text-gray-700 leading-relaxed">
            You are responsible for maintaining your own device and browser data.
            SteadyTrack stores your study data in your browser's localStorage. We
            recommend backing up your data periodically, as we cannot recover data
            if you clear your browser storage.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            4. Acceptable Use Policy
          </h2>
          <p className="text-gray-700 leading-relaxed mb-4">You agree NOT to:</p>
          <ul className="list-disc pl-6 text-gray-700 space-y-2 mb-4">
            <li>Use the Service for any illegal or unauthorized purpose</li>
            <li>
              Attempt to gain unauthorized access to any part of the Service or
              our systems
            </li>
            <li>
              Interfere with or disrupt the Service or servers/networks connected
              to the Service
            </li>
            <li>
              Use automated means (bots, scripts, etc.) to scrape, crawl, or
              excessively access the Service
            </li>
            <li>
              Circumvent, disable, or interfere with security features, rate
              limits, or monitoring intended to protect the Service
            </li>
            <li>
              Reverse engineer, decompile, or attempt to extract source code from
              the Service
            </li>
            <li>
              Copy, reproduce, or redistribute curriculum content for commercial
              purposes
            </li>
            <li>
              Impersonate another person or misrepresent your affiliation with
              any organization
            </li>
            <li>
              Use the Service in any way that could harm minors or violate
              privacy laws
            </li>
          </ul>
          <p className="text-gray-700 leading-relaxed">
            Violation of these terms may result in restriction or blocking of
            access to the Service.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            5. Free Service and No Warranties
          </h2>

          <h3 className="text-xl font-semibold text-gray-900 mb-3">
            5.1 Free Service
          </h3>
          <p className="text-gray-700 leading-relaxed mb-4">
            SteadyTrack is provided completely free of charge. There are no
            premium tiers, hidden fees, or paid features. We reserve the right to
            introduce paid features in the future, but the core functionality will
            remain free.
          </p>

          <h3 className="text-xl font-semibold text-gray-900 mb-3">
            5.2 "As Is" Service
          </h3>
          <p className="text-gray-700 leading-relaxed mb-4">
            THE SERVICE IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES
            OF ANY KIND, EITHER EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO:
          </p>
          <ul className="list-disc pl-6 text-gray-700 space-y-2 mb-4">
            <li>
              Warranties of merchantability, fitness for a particular purpose, or
              non-infringement
            </li>
            <li>
              Any warranty that the Service will be uninterrupted, timely,
              secure, or error-free
            </li>
            <li>
              Any warranty regarding the accuracy, completeness, or reliability
              of study plans or curriculum content
            </li>
            <li>
              Any warranty that defects will be corrected or that the Service is
              free from viruses or harmful components
            </li>
          </ul>

          <h3 className="text-xl font-semibold text-gray-900 mb-3">
            5.3 Educational Disclaimer
          </h3>
          <p className="text-gray-700 leading-relaxed">
            We make no guarantees about academic outcomes, diploma exam results,
            or educational achievement. Study plans are based on Alberta
            curriculum guidelines but are not endorsed by Alberta Education or any
            school board. You should verify all educational content and supplement
            SteadyTrack with other learning resources.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            6. Limitation of Liability
          </h2>
          <p className="text-gray-700 leading-relaxed mb-4">
            TO THE MAXIMUM EXTENT PERMITTED BY LAW, STEADYTRACK AND ITS CREATOR
            SHALL NOT BE LIABLE FOR:
          </p>
          <ul className="list-disc pl-6 text-gray-700 space-y-2 mb-4">
            <li>
              Any indirect, incidental, special, consequential, or punitive
              damages
            </li>
            <li>
              Any loss of profits, revenue, data, use, goodwill, or other
              intangible losses
            </li>
            <li>
              Any damages resulting from:
              <ul className="list-circle pl-6 mt-2 space-y-1">
                <li>Your use or inability to use the Service</li>
                <li>
                  Unauthorized access to or alteration of your data or account
                </li>
                <li>Any conduct or content of third parties on the Service</li>
                <li>Any content obtained from the Service</li>
                <li>
                  Academic outcomes, diploma exam results, or educational
                  decisions made based on the Service
                </li>
              </ul>
            </li>
          </ul>
          <p className="text-gray-700 leading-relaxed mb-4">
            IN NO EVENT SHALL OUR TOTAL LIABILITY TO YOU FOR ALL DAMAGES, LOSSES,
            AND CAUSES OF ACTION EXCEED FIFTY CANADIAN DOLLARS ($50 CAD).
          </p>
          <p className="text-gray-700 leading-relaxed">
            Some jurisdictions do not allow the exclusion of certain warranties or
            limitation of liability for incidental or consequential damages. In
            such jurisdictions, our liability will be limited to the maximum
            extent permitted by law.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            7. Intellectual Property
          </h2>

          <h3 className="text-xl font-semibold text-gray-900 mb-3">
            7.1 Our Content
          </h3>
          <p className="text-gray-700 leading-relaxed mb-4">
            The Service, including its design, code, features, and all content
            (except user-generated content), is owned by SteadyTrack and is
            protected by copyright, trademark, and other intellectual property
            laws. You may not:
          </p>
          <ul className="list-disc pl-6 text-gray-700 space-y-2 mb-4">
            <li>
              Copy, modify, distribute, or create derivative works from our
              content
            </li>
            <li>Use our name, logo, or branding without permission</li>
            <li>
              Scrape, data mine, or extract data from the Service using automated
              means
            </li>
          </ul>

          <h3 className="text-xl font-semibold text-gray-900 mb-3">
            7.2 Curriculum Content
          </h3>
          <p className="text-gray-700 leading-relaxed mb-4">
            Study plans and curriculum outlines are based on publicly available
            Alberta Education resources. We have organized and structured this
            content for educational tracking purposes. Original Alberta Education
            content remains the property of the Government of Alberta.
          </p>

          <h3 className="text-xl font-semibold text-gray-900 mb-3">
            7.3 Your Data
          </h3>
          <p className="text-gray-700 leading-relaxed">
            You retain ownership of your personal data (profile information,
            progress data, etc.). By using the Service, you grant us a limited
            license to store, process, and display this data as necessary to
            provide the Service.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            8. Service Availability and Modifications
          </h2>

          <h3 className="text-xl font-semibold text-gray-900 mb-3">
            8.1 Service Changes
          </h3>
          <p className="text-gray-700 leading-relaxed mb-4">
            We reserve the right to:
          </p>
          <ul className="list-disc pl-6 text-gray-700 space-y-2 mb-4">
            <li>Modify, suspend, or discontinue any part of the Service</li>
            <li>Change these Terms at any time</li>
            <li>Introduce new features or remove existing features</li>
            <li>Limit or restrict access to the Service</li>
          </ul>

          <h3 className="text-xl font-semibold text-gray-900 mb-3">
            8.2 Downtime
          </h3>
          <p className="text-gray-700 leading-relaxed mb-4">
            We strive to provide reliable service, but we do not guarantee that
            the Service will be available at all times. The Service may be
            unavailable due to:
          </p>
          <ul className="list-disc pl-6 text-gray-700 space-y-2 mb-4">
            <li>Scheduled maintenance</li>
            <li>Technical issues or server problems</li>
            <li>Third-party service failures (Google, Supabase, etc.)</li>
            <li>Events beyond our control</li>
          </ul>

          <h3 className="text-xl font-semibold text-gray-900 mb-3">
            8.3 Service Termination
          </h3>
          <p className="text-gray-700 leading-relaxed">
            While we intend to operate SteadyTrack for as long as it's useful to
            students, we reserve the right to discontinue the Service at any time.
            If we decide to shut down SteadyTrack, we will provide reasonable
            notice and allow users to export their data.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            9. Data Clearing and Service Discontinuation
          </h2>

          <h3 className="text-xl font-semibold text-gray-900 mb-3">
            9.1 Clearing Your Data
          </h3>
          <p className="text-gray-700 leading-relaxed mb-4">
            You may stop using the Service and clear your data at any time.
            Because all your data is stored locally in your browser:
          </p>
          <ul className="list-disc pl-6 text-gray-700 space-y-2 mb-4">
            <li>
              Use your browser's "Clear browsing data" feature for this site
            </li>
            <li>Clear localStorage in your browser's developer tools</li>
            <li>
              Simply stop using the Service (your data remains on your device)
            </li>
          </ul>
          <p className="text-gray-700 leading-relaxed mb-4">
            <strong>Note:</strong> Clearing your data is permanent and cannot be
            recovered. We do not store backups of your data.
          </p>

          <h3 className="text-xl font-semibold text-gray-900 mb-3">
            9.2 Restricting Access
          </h3>
          <p className="text-gray-700 leading-relaxed mb-4">
            We reserve the right to restrict or block access to the Service if:
          </p>
          <ul className="list-disc pl-6 text-gray-700 space-y-2 mb-4">
            <li>You violate these Terms</li>
            <li>You engage in abusive, fraudulent, or malicious behavior</li>
            <li>
              Your usage patterns indicate abuse or pose a security risk to the
              Service
            </li>
            <li>We are required to do so by law</li>
          </ul>

          <h3 className="text-xl font-semibold text-gray-900 mb-3">
            9.3 Effect of Service Discontinuation
          </h3>
          <p className="text-gray-700 leading-relaxed">
            If we discontinue the Service, your right to use it immediately
            ceases. Your local data will remain on your device, but curriculum
            content will no longer be accessible. We will provide reasonable
            notice before discontinuation.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            10. Indemnification
          </h2>
          <p className="text-gray-700 leading-relaxed">
            You agree to indemnify, defend, and hold harmless SteadyTrack and its
            creator from any claims, liabilities, damages, losses, and expenses
            (including legal fees) arising from:
          </p>
          <ul className="list-disc pl-6 text-gray-700 space-y-2">
            <li>Your use or misuse of the Service</li>
            <li>Your violation of these Terms</li>
            <li>Your violation of any rights of another person or entity</li>
            <li>
              Any content or data you submit to the Service (though we collect
              minimal user-generated content)
            </li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            11. Dispute Resolution and Governing Law
          </h2>

          <h3 className="text-xl font-semibold text-gray-900 mb-3">
            11.1 Governing Law
          </h3>
          <p className="text-gray-700 leading-relaxed mb-4">
            These Terms are governed by the laws of the Province of Alberta and
            the federal laws of Canada applicable therein, without regard to
            conflict of law principles.
          </p>

          <h3 className="text-xl font-semibold text-gray-900 mb-3">
            11.2 Jurisdiction
          </h3>
          <p className="text-gray-700 leading-relaxed mb-4">
            Any disputes arising from these Terms or your use of the Service shall
            be resolved in the courts of Alberta, Canada. You consent to the
            exclusive jurisdiction and venue of such courts.
          </p>

          <h3 className="text-xl font-semibold text-gray-900 mb-3">
            11.3 Informal Resolution
          </h3>
          <p className="text-gray-700 leading-relaxed">
            Before pursuing legal action, we encourage you to contact us at{' '}
            <a
              href={`mailto:${CONTACT_EMAIL}`}
              className="text-blue-600 hover:text-blue-700"
            >
              {CONTACT_EMAIL}
            </a>{' '}
            to resolve disputes informally.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            12. Severability
          </h2>
          <p className="text-gray-700 leading-relaxed">
            If any provision of these Terms is found to be unlawful, void, or
            unenforceable, that provision shall be deemed severable and shall not
            affect the validity and enforceability of the remaining provisions.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            13. Entire Agreement
          </h2>
          <p className="text-gray-700 leading-relaxed">
            These Terms, together with our Privacy Policy, constitute the entire
            agreement between you and SteadyTrack regarding the Service and
            supersede all prior agreements and understandings.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            14. No Waiver
          </h2>
          <p className="text-gray-700 leading-relaxed">
            Our failure to enforce any right or provision of these Terms shall not
            constitute a waiver of such right or provision. Any waiver of a
            provision must be in writing and signed by us.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            15. Contact Information
          </h2>
          <p className="text-gray-700 leading-relaxed mb-4">
            If you have questions about these Terms of Service, please contact:
          </p>
          <ul className="list-none text-gray-700 space-y-2">
            <li>
              <strong>Email:</strong>{' '}
              <a
                href={`mailto:${CONTACT_EMAIL}`}
                className="text-blue-600 hover:text-blue-700"
              >
                {CONTACT_EMAIL}
              </a>
            </li>
            <li>
              <strong>Service:</strong> SteadyTrack
            </li>
            <li>
              <strong>Created by:</strong> Samuel Kahessay
            </li>
            <li>
              <strong>Last Updated:</strong> October 17, 2025
            </li>
          </ul>
        </section>

        <section className="mt-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            16. External Resources
          </h2>
          <p className="text-gray-700 leading-relaxed mb-4">
            SteadyTrack links to third‑party educational resources (e.g., YouTube,
            Khan Academy) for your convenience. We do not control and are not
            responsible for the content, availability, or privacy practices of
            those sites. Accessing external resources is at your own discretion.
          </p>
          <p className="text-gray-700 leading-relaxed">
            If an external resource is unavailable or inaccurate, it does not
            affect your use of SteadyTrack, and we are not liable for issues
            arising from third‑party content.
          </p>
        </section>

        <section className="mt-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            17. Monitoring and Rate Limiting
          </h2>
          <p className="text-gray-700 leading-relaxed mb-4">
            We use reasonable monitoring and protective controls to maintain
            reliability and security of the Service:
          </p>
          <ul className="list-disc pl-6 text-gray-700 space-y-2 mb-4">
            <li>
              <strong>Error and performance monitoring:</strong> We use Sentry to detect
              and investigate errors and performance issues. Sentry may process
              error details, event metadata (e.g., browser, URL), and sampled
              session replays to help diagnose issues. This data is used solely to
              improve the Service. See the Privacy Policy for details.
            </li>
            <li>
              <strong>Session Replay:</strong> A small percentage of sessions are captured
              to reproduce problems and improve stability. Sensitive inputs are
              masked by default, and we strive to minimize personal data in logs
              and diagnostics. See the Privacy Policy for details.
            </li>
            <li>
              <strong>Rate limiting:</strong> We enforce fair use across API
              endpoints using Upstash Redis. Temporary identifiers derived from
              your IP address may be processed to count requests during the rate
              limit window.
            </li>
          </ul>
          <p className="text-gray-700 leading-relaxed">
            You agree not to bypass or degrade these protections. We may throttle
            or suspend access that violates rate limits or threatens the stability
            or security of the Service.
          </p>
        </section>
      </div>
    </LegalLayout>
  );
}
