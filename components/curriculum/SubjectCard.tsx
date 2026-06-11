'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { BookOpen, Clock, Target, FileText, Award, ChevronRight } from 'lucide-react';
import { SubjectMetadata } from '@/lib/utils/curriculum';

interface SubjectCardProps {
  subject: SubjectMetadata;
  viewMode?: 'grid' | 'list';
}

export default function SubjectCard({ subject, viewMode = 'grid' }: SubjectCardProps) {
  const router = useRouter();

  const colorClasses = {
    blue: 'from-blue-400 to-blue-600 border-blue-300',
    green: 'from-green-400 to-green-600 border-green-300',
    orange: 'from-orange-400 to-orange-600 border-orange-300',
    purple: 'from-purple-400 to-purple-600 border-purple-300',
    indigo: 'from-indigo-400 to-indigo-600 border-indigo-300',
    yellow: 'from-yellow-400 to-yellow-600 border-yellow-300',
  };

  const badgeClasses = {
    blue: 'bg-blue-100 text-blue-700',
    green: 'bg-green-100 text-green-700',
    orange: 'bg-orange-100 text-orange-700',
    purple: 'bg-purple-100 text-purple-700',
    indigo: 'bg-indigo-100 text-indigo-700',
    yellow: 'bg-yellow-100 text-yellow-700',
  };

  // Helpers to allow filter controls inside Link without nesting interactive elements.
  const handleCategoryClick = (e: React.MouseEvent<HTMLElement>, category: string) => {
    e.preventDefault();
    e.stopPropagation();
    router.push(`/curriculum?categories=${category}`);
  };

  const handleGradeClick = (e: React.MouseEvent<HTMLElement>, grade: number) => {
    e.preventDefault();
    e.stopPropagation();
    router.push(`/curriculum?grades=${grade}`);
  };

  const handleDiplomaClick = (e: React.MouseEvent<HTMLElement>) => {
    e.preventDefault();
    e.stopPropagation();
    router.push(`/curriculum?diploma=true&grades=12`);
  };

  const handleKeyActivate = (
    e: React.KeyboardEvent<HTMLElement>,
    onActivate: () => void
  ) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      e.stopPropagation();
      onActivate();
    }
  };

  if (viewMode === 'list') {
    return (
      <Link
        href={`/curriculum/${subject.slug}`}
        className="block bg-white rounded-lg border-2 border-gray-200 hover:border-blue-300 hover:shadow-lg transition-all p-4 group"
      >
        <div className="flex items-center gap-4">
          {/* Icon */}
          <div
            className={`flex-shrink-0 w-16 h-16 rounded-xl bg-gradient-to-br ${
              colorClasses[subject.color as keyof typeof colorClasses]
            } flex items-center justify-center text-3xl shadow-lg`}
          >
            {subject.icon}
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-bold text-lg text-gray-900 group-hover:text-blue-600 transition-colors">
                {subject.name}
              </h3>
              {subject.hasDiploma && (
                <span
                  role="button"
                  tabIndex={0}
                  onClick={handleDiplomaClick}
                  onKeyDown={(e) => handleKeyActivate(e, () => router.push(`/curriculum?diploma=true&grades=12`))}
                  className="flex items-center gap-1 text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full hover:bg-green-200 transition-all"
                  title="Filter diploma subjects"
                >
                  <Award className="w-3 h-3" />
                  Diploma
                </span>
              )}
            </div>

            <div className="flex flex-wrap gap-3 text-sm text-gray-600">
              <div className="flex items-center gap-1">
                <Target className="w-4 h-4" />
                <span>{subject.totalOutcomes} outcomes</span>
              </div>
              <div className="flex items-center gap-1">
                <FileText className="w-4 h-4" />
                <span>{subject.totalResources} resources</span>
              </div>
              <div className="flex items-center gap-1">
                <Clock className="w-4 h-4" />
                <span>~{subject.totalHours}h</span>
              </div>
            </div>
          </div>

          {/* Arrow */}
          <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-blue-600 transition-colors flex-shrink-0" />
        </div>
      </Link>
    );
  }

  // Grid view
  return (
    <Link
      href={`/curriculum/${subject.slug}`}
      className="block bg-white rounded-xl border-2 border-gray-200 hover:border-blue-300 hover:shadow-xl transition-all overflow-hidden group"
    >
      {/* Header with gradient */}
      <div
        className={`bg-gradient-to-br ${
          colorClasses[subject.color as keyof typeof colorClasses]
        } p-6 relative overflow-hidden`}
      >
        <div className="relative z-10">
          <div className="text-5xl mb-3">{subject.icon}</div>
          <h3 className="font-bold text-xl text-white drop-shadow-lg mb-1">
            {subject.name}
          </h3>
          <div className="flex items-center gap-2">
            <span
              role="button"
              tabIndex={0}
              onClick={(e) => handleGradeClick(e, subject.grade)}
              onKeyDown={(e) => handleKeyActivate(e, () => router.push(`/curriculum?grades=${subject.grade}`))}
              className="text-white/90 text-sm hover:text-white hover:underline transition-all"
              title={`Filter by Grade ${subject.grade}`}
            >
              Grade {subject.grade}
            </span>
            {subject.hasDiploma && (
              <span
                role="button"
                tabIndex={0}
                onClick={handleDiplomaClick}
                onKeyDown={(e) => handleKeyActivate(e, () => router.push(`/curriculum?diploma=true&grades=12`))}
                className="flex items-center gap-1 text-xs bg-white/20 backdrop-blur-sm text-white px-2 py-0.5 rounded-full hover:bg-white/30 transition-all"
                title="Filter diploma subjects"
              >
                <Award className="w-3 h-3" />
                Diploma
              </span>
            )}
          </div>
        </div>

        {/* Decorative background pattern */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16" />
        <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/10 rounded-full -ml-12 -mb-12" />
      </div>

      {/* Stats */}
      <div className="p-4">
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="bg-gray-50 rounded-lg p-3">
            <div className="flex items-center gap-1.5 text-gray-600 mb-1">
              <Target className="w-4 h-4" />
              <span className="text-xs font-medium">Outcomes</span>
            </div>
            <div className="text-2xl font-bold text-gray-900">
              {subject.totalOutcomes}
            </div>
          </div>

          <div className="bg-gray-50 rounded-lg p-3">
            <div className="flex items-center gap-1.5 text-gray-600 mb-1">
              <FileText className="w-4 h-4" />
              <span className="text-xs font-medium">Resources</span>
            </div>
            <div className="text-2xl font-bold text-gray-900">
              {subject.totalResources}
            </div>
          </div>
        </div>

        {/* Units info */}
        <div className="bg-blue-50 rounded-lg p-3 mb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-blue-600" />
              <span className="text-sm font-medium text-blue-900">
                {subject.data.units.length} Units
              </span>
            </div>
            <div className="flex items-center gap-1 text-blue-700">
              <Clock className="w-3.5 h-3.5" />
              <span className="text-xs font-medium">~{subject.totalHours}h</span>
            </div>
          </div>
        </div>

        {/* Category badge */}
        <div className="flex items-center justify-between">
          <span
            role="button"
            tabIndex={0}
            onClick={(e) => handleCategoryClick(e, subject.category)}
            onKeyDown={(e) => handleKeyActivate(e, () => router.push(`/curriculum?categories=${subject.category}`))}
            className={`text-xs px-2.5 py-1 rounded-full font-medium hover:ring-2 hover:ring-offset-2 transition-all ${
              badgeClasses[subject.color as keyof typeof badgeClasses]
            } ${
              subject.category === 'science' ? 'hover:ring-green-400' :
              subject.category === 'math' ? 'hover:ring-blue-400' :
              'hover:ring-indigo-400'
            }`}
            title={`Filter by ${subject.category === 'science' ? 'Science' : subject.category === 'math' ? 'Mathematics' : 'Humanities'}`}
          >
            {subject.category === 'science' && '🔬 Science'}
            {subject.category === 'math' && '📐 Mathematics'}
            {subject.category === 'humanities' && '📚 Humanities'}
          </span>

          <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-blue-600 transition-colors" />
        </div>
      </div>
    </Link>
  );
}
