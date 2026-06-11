'use client';

import { useState, useMemo, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import {
  Sparkles,
  Target,
  BookOpen,
  Award,
  ArrowRight,
} from 'lucide-react';
import {
  getAllSubjectsWithMetadata,
  getCurriculumStats,
  filterSubjects,
} from '@/lib/utils/curriculum';
import CurriculumFilters, { FilterState } from '@/components/curriculum/CurriculumFilters';
import CurriculumSearch from '@/components/curriculum/CurriculumSearch';
import SubjectCard from '@/components/curriculum/SubjectCard';
import Footer from '@/components/landing/Footer';

function CurriculumContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  // Initialize filters from URL params
  const initialFilters: FilterState = useMemo(() => {
    const gradesParam = searchParams.get('grades');
    const categoriesParam = searchParams.get('categories');
    const diplomaParam = searchParams.get('diploma');
    const viewModeParam = searchParams.get('view');

    return {
      grades: gradesParam ? gradesParam.split(',').map(Number) : [],
      categories: categoriesParam ? categoriesParam.split(',') : [],
      diplomaOnly: diplomaParam === 'true',
      viewMode: (viewModeParam === 'list' ? 'list' : 'grid') as 'grid' | 'list',
    };
  }, [searchParams]);

  const [filters, setFilters] = useState<FilterState>(initialFilters);

  // Update URL when filters change
  useEffect(() => {
    const params = new URLSearchParams();

    if (filters.grades.length > 0) {
      params.set('grades', filters.grades.join(','));
    }
    if (filters.categories.length > 0) {
      params.set('categories', filters.categories.join(','));
    }
    if (filters.diplomaOnly) {
      params.set('diploma', 'true');
    }
    if (filters.viewMode !== 'grid') {
      params.set('view', filters.viewMode);
    }

    const queryString = params.toString();
    const newUrl = queryString ? `/curriculum?${queryString}` : '/curriculum';

    // Only update if the URL is different
    if (window.location.pathname + window.location.search !== newUrl) {
      router.replace(newUrl, { scroll: false });
    }
  }, [filters, router]);

  const stats = useMemo(() => getCurriculumStats(), []);
  const allSubjects = useMemo(() => getAllSubjectsWithMetadata(), []);

  const filteredSubjects = useMemo(() => {
    return filterSubjects({
      grades: filters.grades,
      categories: filters.categories,
      diplomaOnly: filters.diplomaOnly,
    });
  }, [filters]);

  const displaySubjects = filteredSubjects;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
      {/* Hero Section */}
      <section className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-8">
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold mb-4">
              Curriculum Explorer
            </h1>

            <p className="text-xl text-blue-100 max-w-3xl mx-auto">
              Browse 12 subjects with detailed outcomes and curated resources.
            </p>
          </div>

          {/* Quick Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-4xl mx-auto">
            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4 text-center">
              <div className="text-3xl font-bold mb-1">{stats.totalSubjects}</div>
              <div className="text-sm text-blue-100">Subjects</div>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4 text-center">
              <div className="text-3xl font-bold mb-1">{stats.totalOutcomes}</div>
              <div className="text-sm text-blue-100">Outcomes</div>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4 text-center">
              <div className="text-3xl font-bold mb-1">{stats.totalResources}</div>
              <div className="text-sm text-blue-100">Resources</div>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4 text-center">
              <div className="text-3xl font-bold mb-1">{stats.totalHours}+</div>
              <div className="text-sm text-blue-100">Study Hours</div>
            </div>
          </div>
        </div>
      </section>

      {/* Main Content */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Search Bar */}
        <div className="mb-8">
          <CurriculumSearch />
        </div>

        {/* Layout: Sidebar + Content */}
        <div className="lg:grid lg:grid-cols-[280px,1fr] lg:gap-8">
          {/* Sidebar Filters */}
          <aside className="mb-8 lg:mb-0">
            <div className="sticky top-4">
              <CurriculumFilters filters={filters} onFilterChange={setFilters} />
            </div>
          </aside>

          {/* Main Content Area */}
          <main>
            {/* Results Header */}
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">
                  {filteredSubjects.length > 0 && filteredSubjects.length !== allSubjects.length
                    ? `${filteredSubjects.length} Subject${
                        filteredSubjects.length !== 1 ? 's' : ''
                      }`
                    : 'All Subjects'}
                </h2>
                <p className="text-sm text-gray-600 mt-1">
                  {filteredSubjects.length > 0 && filteredSubjects.length !== allSubjects.length
                    ? 'Filtered results'
                    : 'Showing all available subjects'}
                </p>
              </div>

              {/* View mode indicator (mobile) */}
              <div className="lg:hidden">
                <span className="text-sm text-gray-600">
                  {filters.viewMode === 'grid' ? 'Grid' : 'List'} view
                </span>
              </div>
            </div>

            {/* Subject Grid/List */}
            {displaySubjects.length > 0 ? (
              <div
                className={
                  filters.viewMode === 'grid'
                    ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-6'
                    : 'space-y-4'
                }
              >
                {displaySubjects.map((subject) => (
                  <SubjectCard
                    key={subject.slug}
                    subject={subject}
                    viewMode={filters.viewMode}
                  />
                ))}
              </div>
            ) : (
              <div className="bg-white rounded-lg border-2 border-gray-200 p-12 text-center">
                <Sparkles className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  No subjects found
                </h3>
                <p className="text-gray-600 mb-4">
                  Try adjusting your filters to see more results
                </p>
                <button
                  onClick={() =>
                    setFilters({
                      grades: [],
                      categories: [],
                      diplomaOnly: false,
                      viewMode: filters.viewMode,
                    })
                  }
                  className="text-blue-600 hover:text-blue-700 font-medium"
                >
                  Clear all filters
                </button>
              </div>
            )}
          </main>
        </div>

        {/* Additional Info Sections */}
        <div className="mt-16 grid md:grid-cols-2 gap-8">
          {/* Diploma Subjects */}
          <div className="bg-white rounded-xl p-6 shadow-lg border-2 border-green-200">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                <Award className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <h3 className="font-bold text-gray-900 mb-2">Diploma Subjects</h3>
                <p className="text-sm text-gray-600 mb-3">
                  Grade 12 diploma exams are worth 30% of your final mark.
                </p>
                <button
                  onClick={() =>
                    setFilters({
                      ...filters,
                      diplomaOnly: true,
                      grades: [12],
                    })
                  }
                  className="text-sm text-green-600 hover:text-green-700 font-medium flex items-center gap-1"
                >
                  View diploma subjects
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Verified Content */}
          <div className="bg-white rounded-xl p-6 shadow-lg border-2 border-blue-200">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                <Target className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <h3 className="font-bold text-gray-900 mb-2">Curriculum-Aligned</h3>
                <p className="text-sm text-gray-600 mb-3">
                  Every outcome maps to official Alberta Education curriculum documents.
                </p>
                <a
                  href="https://curriculum.learnalberta.ca/curriculum/en"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1"
                >
                  View official docs
                  <ArrowRight className="w-4 h-4" />
                </a>
              </div>
            </div>
          </div>
        </div>

        {/* CTA Section */}
        <div className="mt-16 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl p-8 sm:p-12 text-center text-white shadow-xl">
          <BookOpen className="w-16 h-16 mx-auto mb-4 opacity-90" />
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">
            Create Your Study Plan
          </h2>
          <p className="text-lg text-blue-100 mb-6 max-w-2xl mx-auto">
            Get a personalized schedule based on your subjects. Set up in under 1 minute.
          </p>
          <Link
            href="/plan/new"
            className="inline-block bg-white text-blue-600 hover:bg-blue-50 font-semibold text-lg px-8 py-4 rounded-lg shadow-xl transition-all hover:scale-105"
          >
            Get Started
          </Link>
        </div>
      </section>

      <Footer />
    </div>
  );
}

export default function CurriculumPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading curriculum...</p>
        </div>
      </div>
    }>
      <CurriculumContent />
    </Suspense>
  );
}
