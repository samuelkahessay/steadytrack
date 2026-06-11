import { notFound } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  BookOpen,
  Target,
  FileText,
  Clock,
  Award,
  CheckCircle,
  ExternalLink,
  Download,
  Sparkles,
} from 'lucide-react';
import { getSubjectBySlug, getRelatedSubjects } from '@/lib/utils/curriculum';
import UnitAccordion from '@/components/curriculum/UnitAccordion';
import SubjectCard from '@/components/curriculum/SubjectCard';
import SubjectShareButton from '@/components/curriculum/SubjectShareButton';
import Footer from '@/components/landing/Footer';

interface PageProps {
  params: Promise<{
    slug: string;
  }>;
}

export default async function SubjectDetailPage({ params }: PageProps) {
  const { slug } = await params;
  const subject = getSubjectBySlug(slug);

  if (!subject) {
    notFound();
  }

  const relatedSubjects = getRelatedSubjects(slug, 3);

  const colorClasses = {
    blue: 'from-blue-500 to-blue-700',
    green: 'from-green-500 to-green-700',
    orange: 'from-orange-500 to-orange-700',
    purple: 'from-purple-500 to-purple-700',
    indigo: 'from-indigo-500 to-indigo-700',
    yellow: 'from-yellow-500 to-yellow-700',
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      {/* Hero Header */}
      <header
        className={`bg-gradient-to-r ${
          colorClasses[subject.color as keyof typeof colorClasses]
        } text-white py-12 relative overflow-hidden`}
      >
        <div className="absolute inset-0 bg-black/10"></div>
        <div className="absolute top-0 right-0 w-96 h-96 bg-white/5 rounded-full -mr-48 -mt-48"></div>
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-white/5 rounded-full -ml-32 -mb-32"></div>

        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          {/* Back button */}
          <Link
            href="/curriculum"
            className="inline-flex items-center gap-2 text-white/90 hover:text-white mb-6 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="text-sm font-medium">Back to all subjects</span>
          </Link>

          <div className="flex items-start gap-6">
            {/* Icon */}
            <div className="flex-shrink-0 w-24 h-24 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center text-5xl shadow-lg">
              {subject.icon}
            </div>

            {/* Content */}
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <h1 className="text-4xl sm:text-5xl font-bold">{subject.name}</h1>
                {subject.hasDiploma && (
                  <Link
                    href="/curriculum?diploma=true&grades=12"
                    className="flex items-center gap-1 text-sm bg-white/20 backdrop-blur-sm px-3 py-1 rounded-full hover:bg-white/30 transition-all"
                    title="View all diploma subjects"
                  >
                    <Award className="w-4 h-4" />
                    Diploma
                  </Link>
                )}
              </div>

              <Link
                href={`/curriculum?grades=${subject.grade}`}
                className="inline-block text-white/90 text-lg mb-4 hover:text-white hover:underline transition-all"
                title={`View all Grade ${subject.grade} subjects`}
              >
                Grade {subject.grade}
              </Link>

              {/* Quick stats */}
              <div className="flex flex-wrap gap-4">
                <div className="flex items-center gap-2 bg-white/20 backdrop-blur-sm px-4 py-2 rounded-lg">
                  <BookOpen className="w-5 h-5" />
                  <span className="font-semibold">{subject.data.units.length} Units</span>
                </div>
                <div className="flex items-center gap-2 bg-white/20 backdrop-blur-sm px-4 py-2 rounded-lg">
                  <Target className="w-5 h-5" />
                  <span className="font-semibold">{subject.totalOutcomes} Outcomes</span>
                </div>
                <div className="flex items-center gap-2 bg-white/20 backdrop-blur-sm px-4 py-2 rounded-lg">
                  <FileText className="w-5 h-5" />
                  <span className="font-semibold">{subject.totalResources} Resources</span>
                </div>
                <div className="flex items-center gap-2 bg-white/20 backdrop-blur-sm px-4 py-2 rounded-lg">
                  <Clock className="w-5 h-5" />
                  <span className="font-semibold">~{subject.totalHours} Hours</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Quick Actions */}
        <div className="flex flex-wrap gap-3 mb-8">
          <Link
            href="/plan/new"
            className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-semibold transition-colors shadow-lg"
          >
            <Sparkles className="w-5 h-5" />
            Create Study Plan
          </Link>
          <SubjectShareButton subjectName={subject.name} />
        </div>

        {/* Alberta Alignment Badge */}
        <div className="bg-green-50 border-2 border-green-200 rounded-xl p-6 mb-8">
          <div className="flex items-start gap-4">
            <CheckCircle className="w-8 h-8 text-green-600 flex-shrink-0" />
            <div className="flex-1">
              <h2 className="font-bold text-green-900 mb-2">
                100% Alberta Education Aligned
              </h2>
              <p className="text-sm text-green-800 mb-3">
                All {subject.totalOutcomes} curriculum outcomes are verified against
                official Alberta Education Program of Studies.
                {subject.hasDiploma &&
                  ' This subject includes a diploma exam worth 30% of your final mark.'}
              </p>

              {/* Alberta Docs */}
              {subject.data.albertaDocs && subject.data.albertaDocs.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-semibold text-green-900">
                    Official Documents:
                  </p>
                  {subject.data.albertaDocs.map((doc, idx) => (
                    <a
                      key={idx}
                      href={doc.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 text-sm text-green-700 hover:text-green-900 group"
                    >
                      <Download className="w-4 h-4" />
                      <span className="underline">{doc.title}</span>
                      <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </a>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Units Section */}
        <section className="mb-12">
          <div className="flex items-center gap-3 mb-6">
            <BookOpen className="w-6 h-6 text-blue-600" />
            <h2 className="text-2xl font-bold text-gray-900">
              Curriculum Units ({subject.data.units.length})
            </h2>
          </div>

          <div className="space-y-4">
            {subject.data.units.map((unit, idx) => (
              <UnitAccordion
                key={unit.id}
                unit={unit}
                subject={subject.name}
                isInitiallyExpanded={idx === 0}
              />
            ))}
          </div>
        </section>

        {/* Related Subjects */}
        {relatedSubjects.length > 0 && (
          <section>
            <div className="flex items-center gap-3 mb-6">
              <Sparkles className="w-6 h-6 text-purple-600" />
              <h2 className="text-2xl font-bold text-gray-900">Related Subjects</h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {relatedSubjects.map((relatedSubject) => (
                <SubjectCard
                  key={relatedSubject.slug}
                  subject={relatedSubject}
                  viewMode="grid"
                />
              ))}
            </div>
          </section>
        )}

        {/* CTA */}
        <div className="mt-12 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl p-8 text-center text-white shadow-xl">
          <h3 className="text-2xl font-bold mb-3">Ready to Start Studying?</h3>
          <p className="text-blue-100 mb-6 max-w-2xl mx-auto">
            Create a personalized study plan for {subject.name} and other subjects.
            Get a custom schedule based on your exam dates and time availability.
          </p>
          <Link
            href="/plan/new"
            className="inline-block bg-white text-blue-600 hover:bg-blue-50 font-semibold px-8 py-4 rounded-lg shadow-lg transition-all hover:scale-105"
          >
            Create Your Study Plan
          </Link>
        </div>
      </main>

      <Footer />
    </div>
  );
}

// Generate metadata for SEO
export async function generateMetadata({ params }: PageProps) {
  const { slug } = await params;
  const subject = getSubjectBySlug(slug);

  if (!subject) {
    return {
      title: 'Subject Not Found',
    };
  }

  return {
    title: `${subject.name} - Alberta Curriculum`,
    description: `Explore the ${subject.name} curriculum with ${subject.totalOutcomes} outcomes and ${subject.totalResources} curated resources. Aligned with Alberta Education.`,
    openGraph: {
      title: 'SteadyTrack - Stay On Track',
      description: `Explore the ${subject.name} curriculum with ${subject.totalOutcomes} outcomes and ${subject.totalResources} curated resources. Aligned with Alberta Education.`,
    },
    twitter: {
      title: 'SteadyTrack - Stay On Track',
      description: `Explore the ${subject.name} curriculum with ${subject.totalOutcomes} outcomes and ${subject.totalResources} curated resources. Aligned with Alberta Education.`,
    },
  };
}
