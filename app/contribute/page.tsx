import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import ContributorsSidebar from '@/components/contribute/ContributorsSidebar';
import Footer from '@/components/landing/Footer';

export const metadata = {
  title: 'Contribute | SteadyTrack',
  description: 'How students, educators, and developers helped build SteadyTrack during the 2025 Alberta teacher strike.',
};

export default function ContributePage() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50">
      {/* Header with back button */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-700 font-medium transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            Back to Home
          </Link>
        </div>
      </div>

      {/* Hero Section */}
      <section className="py-12 bg-gradient-to-br from-blue-600 to-indigo-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-[1fr_300px] gap-8 items-start">
            {/* Main Content */}
            <div className="text-center md:text-left">
              <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold text-white mb-4">
                Contribute to SteadyTrack
              </h1>
              <p className="text-lg text-blue-100 max-w-2xl md:max-w-none">
                SteadyTrack was built with help from students, educators, and developers to
                support Alberta students during the 2025 teacher strike.
              </p>
            </div>

            {/* Contributors Sidebar */}
            <div className="md:sticky md:top-8">
              <ContributorsSidebar />
            </div>
          </div>
        </div>
      </section>

      {/* How You Can Help Section */}
      <section className="py-16 bg-white">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
              How You Can Help
            </h2>
            <p className="text-lg text-gray-600">
              There are many ways to contribute to this project
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Contribution cards */}
            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-6 border border-blue-200">
              <div className="text-3xl mb-3">🧪</div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                Test & Provide Feedback
              </h3>
              <p className="text-gray-700">
                Use the platform and share what works well and what could be improved.
              </p>
            </div>

            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-6 border border-blue-200">
              <div className="text-3xl mb-3">📝</div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                Create Content
              </h3>
              <p className="text-gray-700">
                Write study resources, practice problems, or explanations for curriculum outcomes.
              </p>
            </div>

            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-6 border border-blue-200">
              <div className="text-3xl mb-3">🎓</div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                Subject Expertise
              </h3>
              <p className="text-gray-700">
                Review content accuracy for specific subjects you know well.
              </p>
            </div>

            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-6 border border-blue-200">
              <div className="text-3xl mb-3">💻</div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                Technical Development
              </h3>
              <p className="text-gray-700">
                Contribute code, fix bugs, or help improve the platform&apos;s features.
              </p>
            </div>

            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-6 border border-blue-200">
              <div className="text-3xl mb-3">💡</div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                Share Ideas
              </h3>
              <p className="text-gray-700">
                Suggest features or improvements that could help students stay on track.
              </p>
            </div>

            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-6 border border-blue-200">
              <div className="text-3xl mb-3">🤝</div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                Other Ways
              </h3>
              <p className="text-gray-700">
                Have another idea? We&apos;re open to all suggestions for supporting students.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Signups closed when the app was archived */}
      <section className="py-16 bg-gray-50">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-4">
            Signups are closed
          </h2>
          <p className="text-lg text-gray-600 mb-6">
            SteadyTrack is archived and no longer takes contributors. The source is public
            if you want to run it, study it, or build on it.
          </p>
          <a
            href="https://github.com/samuelkahessay/steadytrack"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-6 py-3 font-semibold text-white transition-colors hover:bg-blue-700"
          >
            View the source on GitHub
          </a>
        </div>
      </section>

      {/* Footer */}
      <Footer />
    </main>
  );
}
