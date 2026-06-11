/* eslint-disable react/no-unescaped-entities */
import LegalLayout from '@/components/legal/LegalLayout';
import { CONTACT_EMAIL } from '@/lib/constants';

export const metadata = {
  title: 'Privacy Policy - SteadyTrack',
  description: 'Privacy Policy for SteadyTrack - Learn how we protect your data',
};

export default function PrivacyPage() {
  return (
    <LegalLayout title="Privacy Policy" lastUpdated="October 17, 2025">
      <div className="prose prose-gray max-w-none">
        <section className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            1. Introduction
          </h2>
          <p className="text-gray-700 leading-relaxed mb-4">
            SteadyTrack ("we," "us," or "our") is committed to protecting your
            privacy. This Privacy Policy explains how we collect, use, store,
            and protect your personal information when you use our educational
            tracking platform designed for Alberta high school students.
          </p>
          <p className="text-gray-700 leading-relaxed">
            We built SteadyTrack with privacy as a core principle. We don't sell
            your data, we don't use ads, and we only collect what's necessary to
            provide you with a personalized study tracking experience.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            2. Information We Collect
          </h2>

          <h3 className="text-xl font-semibold text-gray-900 mb-3">
            2.1 Local Browser Data
          </h3>
          <p className="text-gray-700 leading-relaxed mb-4">
            SteadyTrack does NOT collect or store any personal information on
            our servers. All data you create stays on your device in your
            browser's localStorage:
          </p>
          <ul className="list-disc pl-6 text-gray-700 space-y-2 mb-4">
            <li>Your study plan (subjects, grade level, duration, dates)</li>
            <li>Your study progress (which units you've completed)</li>
            <li>
              Your study streaks (days studied, longest streak, current streak)
            </li>
            <li>Your resource completion tracking</li>
            <li>Your infinite learning session progress</li>
            <li>Your quick check activity</li>
          </ul>
          <p className="text-gray-700 leading-relaxed mb-4">
            This data is stored locally using keys prefixed with{' '}
            <code>steadytrack:v1:</code> and remains entirely on your device. We
            cannot access, view, or retrieve this data.
          </p>

          <h3 className="text-xl font-semibold text-gray-900 mb-3">
            2.2 No Account Required
          </h3>
          <p className="text-gray-700 leading-relaxed mb-4">
            SteadyTrack does not require account creation or authentication:
          </p>
          <ul className="list-disc pl-6 text-gray-700 space-y-2 mb-4">
            <li>No email address required</li>
            <li>No passwords or credentials</li>
            <li>No sign-up or login process</li>
            <li>No user identifiers stored on our servers</li>
          </ul>

          <h3 className="text-xl font-semibold text-gray-900 mb-3">
            2.3 Analytics Data
          </h3>
          <p className="text-gray-700 leading-relaxed mb-4">
            We collect minimal, anonymized analytics to improve SteadyTrack:
          </p>
          <ul className="list-disc pl-6 text-gray-700 space-y-2 mb-4">
            <li>
              <strong>Vercel Analytics (third-party):</strong> anonymized page
              views and basic device info (e.g., pages visited, browser
              type/version, device type, country/region). No cookies are used and
              this data cannot identify individual users.
            </li>
          </ul>
          <p className="text-gray-700 leading-relaxed">
            We do NOT collect any personal usage data. Your study activity,
            progress, and streaks are stored locally on your device only and are
            never transmitted to our servers.
          </p>

          <h3 className="text-xl font-semibold text-gray-900 mb-3">2.4 Error, Performance, and Session Replay Data</h3>
          <p className="text-gray-700 leading-relaxed mb-4">
            We use Sentry to help us detect, investigate, and fix errors and
            performance issues. When an error occurs, Sentry may collect details
            such as error messages, stack traces, page URLs, timestamps, basic
            device and browser information, and approximate location derived from
            IP address. We also use Sentry Session Replay on a sampled basis to
            see how the app behaved around errors to improve reliability.
          </p>
          <ul className="list-disc pl-6 text-gray-700 space-y-2 mb-4">
            <li>
              <strong>Session Replay sampling:</strong> approximately 10% of sessions are
              captured; sessions with errors may be captured at a higher rate.
            </li>
            <li>
              <strong>What Replay can capture:</strong> page content, clicks, scrolls,
              navigation, and UI state. Sentry masks form inputs by default, and we
              take care to minimize personal data in error contexts; however, visual
              content shown on screen may appear in a replay.
            </li>
            <li>
              <strong>PII scrubbing:</strong> we proactively redact common identifiers (e.g.,
              emails, tokens) from logs and contexts where feasible before sending
              to Sentry.
            </li>
            <li>
              <strong>No advertising use:</strong> error, performance, and replay data are
              used solely to improve the service and are not sold.
            </li>
          </ul>

          <h3 className="text-xl font-semibold text-gray-900 mb-3">2.5 Rate Limiting Identifiers</h3>
          <p className="text-gray-700 leading-relaxed mb-4">
            To protect the service from abuse, we enforce rate limits using
            Upstash Redis. For this purpose, we temporarily process identifiers
            derived from your IP address together with the API path you are
            calling. These identifiers are used solely to count requests and are
            retained only for the rate limit window.
          </p>
        
          <h3 className="text-xl font-semibold text-gray-900 mb-3">2.6 Cookies and Local Storage</h3>
          <p className="text-gray-700 leading-relaxed mb-4">
            SteadyTrack uses localStorage to save your data:
          </p>
          <ul className="list-disc pl-6 text-gray-700 space-y-2 mb-4">
            <li>
              <strong>No cookies:</strong> SteadyTrack does not set any cookies
              for authentication, tracking, or any other purpose.
            </li>
            <li>
              <strong>Anonymized analytics:</strong> Vercel Analytics does not set
              cookies.
            </li>
            <li>
              <strong>Local storage:</strong> All your study data (plan, progress,
              streaks) is stored in your browser's localStorage with keys prefixed
              with <code>steadytrack:v1:</code>. This data remains on your device
              and can be cleared at any time from your browser settings or from
              within the app.
            </li>
          </ul>
          <p className="text-gray-700 leading-relaxed">
            Because we don't use cookies or authentication, you can use
            SteadyTrack immediately without any cookie consent banners or account
            setup.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            3. How We Use Your Information
          </h2>
          <p className="text-gray-700 leading-relaxed mb-4">
            Because SteadyTrack is local-first with no server-side user data
            storage, we do NOT use your personal information. Your study data
            (plan, progress, streaks) stays on your device and is never
            transmitted to our servers.
          </p>
          <p className="text-gray-700 leading-relaxed mb-4">
            We use anonymized, aggregated data from Vercel Analytics and Sentry
            solely to:
          </p>
          <ul className="list-disc pl-6 text-gray-700 space-y-2 mb-4">
            <li>Understand how users navigate the platform</li>
            <li>Detect and fix errors and performance issues</li>
            <li>Improve the user experience and platform stability</li>
          </ul>
          <p className="text-gray-700 leading-relaxed font-semibold mb-2">
            We will never:
          </p>
          <ul className="list-disc pl-6 text-gray-700 space-y-2">
            <li>Sell your data to third parties</li>
            <li>Use your data for advertising or marketing</li>
            <li>Share your data with schools or educational institutions</li>
            <li>Track you across other websites or apps</li>
            <li>Link your study activity to your identity</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            4. How We Store and Protect Your Data
          </h2>

          <h3 className="text-xl font-semibold text-gray-900 mb-3">
            4.1 Local-First Data Storage
          </h3>
          <p className="text-gray-700 leading-relaxed mb-4">
            All your personal study data (plans, progress, streaks) is stored
            exclusively in your browser's localStorage on your device. We do NOT
            store any personal study data on our servers or in any cloud database.
          </p>
          <p className="text-gray-700 leading-relaxed mb-4">
            <strong>What this means for you:</strong>
          </p>
          <ul className="list-disc pl-6 text-gray-700 space-y-2 mb-4">
            <li>Your data never leaves your device</li>
            <li>We cannot access, view, or retrieve your study data</li>
            <li>You have complete control over your data</li>
            <li>Works offline after curriculum content is cached</li>
          </ul>

          <h3 className="text-xl font-semibold text-gray-900 mb-3">
            4.2 Security Measures
          </h3>
          <ul className="list-disc pl-6 text-gray-700 space-y-2 mb-4">
            <li>
              All network traffic uses HTTPS encryption to protect data in transit
            </li>
            <li>
              Curriculum content is fetched anonymously from Supabase (no
              authentication required)
            </li>
            <li>
              No authentication or session tokens means no risk of account
              compromise
            </li>
            <li>
              Your localStorage data is protected by your browser's same-origin
              policy
            </li>
          </ul>

          <h3 className="text-xl font-semibold text-gray-900 mb-3">
            4.3 Data Retention
          </h3>
          <p className="text-gray-700 leading-relaxed mb-4">
            Your study data persists in your browser's localStorage until you
            explicitly clear it. You can clear your data at any time by:
          </p>
          <ul className="list-disc pl-6 text-gray-700 space-y-2 mb-4">
            <li>Clearing your browser's localStorage for this site</li>
            <li>Using your browser's "Clear browsing data" feature</li>
            <li>
              Deleting your plan from within the app (if we implement this
              feature)
            </li>
          </ul>
          <p className="text-gray-700 leading-relaxed">
            We recommend exporting your data periodically as a backup in case you
            accidentally clear your browser data.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            5. Third-Party Services
          </h2>
          <p className="text-gray-700 leading-relaxed mb-4">
            SteadyTrack uses the following third-party services:
          </p>

          <h3 className="text-xl font-semibold text-gray-900 mb-3">
            5.1 Vercel Analytics
          </h3>
          <p className="text-gray-700 leading-relaxed mb-4">
            We use Vercel Analytics for anonymized usage statistics. Vercel does
            not use cookies and does not track users across sites. Learn more:{' '}
            <a
              href="https://vercel.com/docs/analytics/privacy-policy"
              className="text-blue-600 hover:text-blue-700"
              target="_blank"
              rel="noopener noreferrer"
            >
              https://vercel.com/docs/analytics/privacy-policy
            </a>
          </p>

          <h3 className="text-xl font-semibold text-gray-900 mb-3">
            5.2 Supabase (Content Hosting Only)
          </h3>
          <p className="text-gray-700 leading-relaxed mb-4">
            We use Supabase exclusively for anonymous, read-only access to
            curriculum content (microcards and educational materials). Supabase
            does NOT store any personal user data for SteadyTrack. All queries are
            anonymous and do not require authentication.
          </p>
          <p className="text-gray-700 leading-relaxed">
            Supabase's Privacy Policy:{' '}
            <a
              href="https://supabase.com/privacy"
              className="text-blue-600 hover:text-blue-700"
              target="_blank"
              rel="noopener noreferrer"
            >
              https://supabase.com/privacy
            </a>
          </p>
          
          <h3 className="text-xl font-semibold text-gray-900 mb-3">
            5.3 Sentry (Error Tracking & Session Replay)
          </h3>
          <p className="text-gray-700 leading-relaxed mb-4">
            We use Sentry to monitor errors and performance, and to collect
            sampled session replays to help diagnose issues. Sentry may process
            error details, event metadata (e.g., user agent, URL), and replay data
            as described in section 2.5. Learn more in Sentry's Privacy Policy:{' '}
            <a
              href="https://sentry.io/privacy/"
              className="text-blue-600 hover:text-blue-700"
              target="_blank"
              rel="noopener noreferrer"
            >
              https://sentry.io/privacy/
            </a>
          </p>

          <h3 className="text-xl font-semibold text-gray-900 mb-3">
            5.4 Upstash Redis (Rate Limiting)
          </h3>
          <p className="text-gray-700 leading-relaxed">
            We use Upstash Redis to enforce rate limits and protect against abuse.
            Upstash stores request counters and identifiers (e.g., IP address
            combined with the API path) for the duration of the rate limit window.
            Upstash's Privacy Policy:{' '}
            <a
              href="https://upstash.com/legal/privacy"
              className="text-blue-600 hover:text-blue-700"
              target="_blank"
              rel="noopener noreferrer"
            >
              https://upstash.com/legal/privacy
            </a>
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            6. Your Rights and Data Control
          </h2>
          <p className="text-gray-700 leading-relaxed mb-4">
            Because SteadyTrack stores all your data locally on your device, you
            have complete control over your personal information:
          </p>

          <h3 className="text-xl font-semibold text-gray-900 mb-3">
            6.1 Access and Viewing
          </h3>
          <p className="text-gray-700 leading-relaxed mb-4">
            Your data is always accessible to you through the app. You can view
            your study plan, progress, and streaks anytime from your dashboard.
            All data is stored in your browser's localStorage under keys prefixed
            with <code>steadytrack:v1:</code>.
          </p>

          <h3 className="text-xl font-semibold text-gray-900 mb-3">
            6.2 Modification
          </h3>
          <p className="text-gray-700 leading-relaxed mb-4">
            You can modify your study plan and update your progress directly
            through the app interface. Changes are immediately reflected in your
            localStorage.
          </p>

          <h3 className="text-xl font-semibold text-gray-900 mb-3">
            6.3 Deletion and Clearing Data
          </h3>
          <p className="text-gray-700 leading-relaxed mb-4">
            You can clear your SteadyTrack data at any time by:
          </p>
          <ul className="list-disc pl-6 text-gray-700 space-y-2 mb-4">
            <li>Using your browser's "Clear browsing data" or "Clear storage" feature for this site</li>
            <li>Clearing localStorage for steadytrack.com in your browser's developer tools</li>
          </ul>
          <p className="text-gray-700 leading-relaxed mb-4">
            <strong>Note:</strong> Clearing your data is permanent and cannot be
            undone. We do not store backups of your data on our servers.
          </p>

          <h3 className="text-xl font-semibold text-gray-900 mb-3">
            6.4 Data Portability
          </h3>
          <p className="text-gray-700 leading-relaxed">
            Your data is stored in standard JSON format in localStorage. You can
            manually export it using your browser's developer tools if needed. We
            may add an export feature in the future for easier data backup.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            7. Children's Privacy
          </h2>
          <p className="text-gray-700 leading-relaxed mb-4">
            SteadyTrack is designed for high school students (typically ages
            14-18). We do not knowingly collect information from children under
            13. If you are under 13, please do not use SteadyTrack or provide any
            information.
          </p>
          <p className="text-gray-700 leading-relaxed">
            If we learn that we have collected personal information from a child
            under 13, we will delete that information as quickly as possible.
            Parents who believe we may have information about a child under 13
            should contact us at{' '}
            <a
              href={`mailto:${CONTACT_EMAIL}`}
              className="text-blue-600 hover:text-blue-700"
            >
              {CONTACT_EMAIL}
            </a>
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            8. International Users
          </h2>
          <p className="text-gray-700 leading-relaxed">
            SteadyTrack is designed for students in Alberta, Canada. Because all
            your personal data is stored locally on your device, there is no data
            transfer to servers in any jurisdiction. Curriculum content is served
            from Supabase (hosted in Canada) via anonymous queries.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            9. Changes to This Policy
          </h2>
          <p className="text-gray-700 leading-relaxed mb-4">
            We may update this Privacy Policy from time to time. If we make
            significant changes, we will post a prominent notice on the platform.
          </p>
          <p className="text-gray-700 leading-relaxed">
            Your continued use of SteadyTrack after changes are posted
            constitutes your acceptance of the updated Privacy Policy. We
            recommend checking this page periodically for updates.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            10. Contact Us
          </h2>
          <p className="text-gray-700 leading-relaxed mb-4">
            If you have questions about this Privacy Policy or how we handle your
            data, please contact us:
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
          </ul>
        </section>

        <section>
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            11. Compliance
          </h2>
          <p className="text-gray-700 leading-relaxed mb-4">
            SteadyTrack is committed to complying with applicable privacy laws,
            including:
          </p>
          <ul className="list-disc pl-6 text-gray-700 space-y-2">
            <li>
              Canada&apos;s Personal Information Protection and Electronic Documents
              Act (PIPEDA)
            </li>
            <li>Alberta&apos;s Personal Information Protection Act (PIPA)</li>
            <li>
              General Data Protection Regulation (GDPR) for users in the European
              Union
            </li>
            <li>
              California Consumer Privacy Act (CCPA) for users in California
            </li>
          </ul>
        </section>
      </div>
    </LegalLayout>
  );
}
