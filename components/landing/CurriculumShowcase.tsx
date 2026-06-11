'use client';

import { useState } from 'react';
import Link from 'next/link';
import { FileText, ExternalLink, ChevronDown, ChevronUp, Sparkles } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { getCurriculumData, getAllSubjects } from '@/data/curriculum';
import { cleanResourceTitle } from '@/lib/utils/title';
import { ScrollReveal, AnimatedCounter } from '@/components/motion';

const FEATURED_SUBJECTS = [
  { key: 'Math 30-1', icon: '📐', color: 'blue' },
  { key: 'Biology 30', icon: '🧬', color: 'green' },
  { key: 'English Language Arts 30-1', icon: '📚', color: 'purple' },
  { key: 'Chemistry 30', icon: '⚗️', color: 'orange' },
];

export default function CurriculumShowcase() {
  const [activeSubject, setActiveSubject] = useState(FEATURED_SUBJECTS[0].key);
  const [expandedUnit, setExpandedUnit] = useState<string | null>(null);

  const subjectData = getCurriculumData(activeSubject);

  // Calculate total outcomes across ALL subjects (not just featured)
  const allSubjects = getAllSubjects();
  const totalOutcomes = allSubjects.reduce((sum, subjectKey) => {
    const data = getCurriculumData(subjectKey);
    return sum + (data?.units.reduce((unitSum, unit) => unitSum + (unit.outcomes?.length || 0), 0) || 0);
  }, 0);

  // Calculate total resources across ALL subjects
  const totalResources = allSubjects.reduce((sum, subjectKey) => {
    const data = getCurriculumData(subjectKey);
    return sum + (data?.units.reduce((unitSum, unit) => unitSum + (unit.resources?.length || 0), 0) || 0);
  }, 0);

  const totalSubjects = allSubjects.length;

  return (
    <section className="py-20 bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <ScrollReveal direction="up">
          <div className="text-center mb-12">
            <h2 className="font-display text-4xl sm:text-5xl font-extrabold tracking-tight text-gray-900 mb-4">
              <span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                Curriculum-Aligned Content
              </span>
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Every unit maps to official Alberta Education curriculum outcomes.
              Study with confidence knowing you&apos;re covering what you need.
            </p>
          </div>
        </ScrollReveal>

        {/* Stats Overview with AnimatedCounter */}
        <div className="max-w-2xl mx-auto mb-12">
          <div className="bg-white rounded-xl p-8 shadow-lg border-2 border-blue-200">
            <div className="flex items-center justify-center gap-8 flex-wrap">
              <AnimatedCounter value={totalOutcomes} label="Outcomes" className="text-center" />
              <div className="w-px h-12 bg-gray-200"></div>
              <AnimatedCounter value={totalResources} label="Resources" className="text-center" />
              <div className="w-px h-12 bg-gray-200"></div>
              <AnimatedCounter value={totalSubjects} label="Subjects" className="text-center" />
            </div>
          </div>
        </div>

        {/* Interactive Subject Explorer */}
        <ScrollReveal direction="up" delay={0.1}>
          <div className="bg-white rounded-2xl shadow-2xl border-2 border-gray-200 overflow-hidden">
            {/* Subject Tabs */}
            <div className="border-b border-gray-200 bg-gray-50">
              <div className="flex overflow-x-auto scrollbar-hide snap-x snap-mandatory -mx-4 px-4 sm:mx-0 sm:px-0">
                {FEATURED_SUBJECTS.map((subject) => {
                  const data = getCurriculumData(subject.key);
                  const outcomeCount = data?.units.reduce((sum, unit) => sum + (unit.outcomes?.length || 0), 0) || 0;

                  return (
                    <button
                      key={subject.key}
                      onClick={() => {
                        setActiveSubject(subject.key);
                        setExpandedUnit(null);
                      }}
                      className={`flex-shrink-0 min-w-[140px] sm:min-w-0 sm:flex-1 px-3 sm:px-6 py-4 text-left transition-all snap-start ${
                        activeSubject === subject.key
                          ? 'bg-white border-b-2 border-blue-600'
                          : 'hover:bg-gray-100'
                      }`}
                    >
                      <div className="flex items-center gap-2 sm:gap-3">
                        <span className="text-2xl sm:text-3xl flex-shrink-0">{subject.icon}</span>
                        <div className="min-w-0">
                          <div className={`font-semibold text-sm sm:text-base truncate ${
                            activeSubject === subject.key ? 'text-blue-600' : 'text-gray-700'
                          }`}>
                            {data?.subject || subject.key}
                          </div>
                          <div className="text-xs text-gray-500 mt-0.5">
                            {outcomeCount} outcomes
                          </div>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Subject Content with AnimatePresence */}
            <AnimatePresence mode="wait">
              <motion.div
                key={activeSubject}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.25, ease: [0.25, 0.1, 0.25, 1] }}
                className="p-8"
              >
                {subjectData && (
                  <>
                    {/* Units */}
                    <div className="space-y-4">
                      <div className="flex items-center gap-2 mb-4">
                        <Sparkles className="w-5 h-5 text-purple-600" />
                        <h4 className="text-lg font-bold text-gray-900">
                          Alberta Curriculum Units ({subjectData.units.length})
                        </h4>
                      </div>

                      {subjectData.units.slice(0, 3).map((unit) => {
                        const isExpanded = expandedUnit === unit.id;
                        const outcomeCount = unit.outcomes?.length || 0;
                        const resourceCount = unit.resources?.length || 0;

                        return (
                          <div
                            key={unit.id}
                            className="border border-gray-200 rounded-lg overflow-hidden hover:border-blue-300 transition-colors"
                          >
                            <button
                              onClick={() => setExpandedUnit(isExpanded ? null : unit.id)}
                              className="w-full px-5 py-4 bg-white hover:bg-gray-50 transition-colors text-left"
                            >
                              <div className="flex items-start justify-between gap-4">
                                <div className="flex-1">
                                  <h5 className="font-semibold text-gray-900 mb-2">{unit.title}</h5>
                                  <div className="flex flex-wrap gap-2">
                                    {unit.estimatedHours && (
                                      <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full">
                                        ~{unit.estimatedHours}h study time
                                      </span>
                                    )}
                                    <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full">
                                      {outcomeCount} outcomes
                                    </span>
                                    <span className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded-full">
                                      {resourceCount} resources
                                    </span>
                                  </div>
                                </div>
                                {isExpanded ? (
                                  <ChevronUp className="w-5 h-5 text-gray-400 flex-shrink-0" />
                                ) : (
                                  <ChevronDown className="w-5 h-5 text-gray-400 flex-shrink-0" />
                                )}
                              </div>
                            </button>

                            {isExpanded && (
                              <div className="border-t border-gray-200 bg-gray-50 p-5">
                                {/* Outcomes */}
                                {unit.outcomes && unit.outcomes.length > 0 && (
                                  <div className="mb-4">
                                    <h6 className="text-sm font-semibold text-gray-700 mb-2">
                                      Alberta Curriculum Outcomes
                                    </h6>
                                    <div className="space-y-2 max-h-48 overflow-y-auto">
                                      {unit.outcomes.slice(0, 5).map((outcome, idx) => (
                                        <div
                                          key={idx}
                                          className="bg-white p-3 rounded border border-gray-200 text-xs"
                                        >
                                          <div className="font-mono font-semibold text-blue-600 mb-1">
                                            {outcome.code}
                                          </div>
                                          {outcome.description && (
                                            <div className="text-gray-600 line-clamp-2">
                                              {outcome.description}
                                            </div>
                                          )}
                                        </div>
                                      ))}
                                      {unit.outcomes.length > 5 && (
                                        <p className="text-xs text-gray-500 italic text-center py-2">
                                          + {unit.outcomes.length - 5} more outcomes...
                                        </p>
                                      )}
                                    </div>
                                  </div>
                                )}

                                {/* Resources */}
                                {unit.resources && unit.resources.length > 0 && (
                                  <div>
                                    <h6 className="text-sm font-semibold text-gray-700 mb-2">
                                      Curated Learning Resources
                                    </h6>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                      {unit.resources.slice(0, 4).map((resource, idx) => (
                                        <a
                                          key={idx}
                                          href={resource.url}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="bg-white p-3 rounded border border-gray-200 hover:border-blue-300 transition-colors group text-xs"
                                        >
                                          <div className="flex items-start justify-between gap-2">
                                            <div className="flex-1 min-w-0">
                                              <div className="font-medium text-gray-900 group-hover:text-blue-600 mb-1 line-clamp-1">
                                                {cleanResourceTitle(resource.title, resource.url)}
                                              </div>
                                              <div className="flex gap-1.5">
                                                <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                                                  resource.type === 'video' ? 'bg-red-100 text-red-700' :
                                                  resource.type === 'article' ? 'bg-blue-100 text-blue-700' :
                                                  resource.type === 'practice' ? 'bg-green-100 text-green-700' :
                                                  'bg-gray-100 text-gray-700'
                                                }`}>
                                                  {resource.type}
                                                </span>
                                                {resource.difficulty && (
                                                  <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-purple-100 text-purple-700">
                                                    {resource.difficulty}
                                                  </span>
                                                )}
                                              </div>
                                            </div>
                                            <ExternalLink className="w-3.5 h-3.5 text-gray-400 group-hover:text-blue-600 flex-shrink-0" />
                                          </div>
                                        </a>
                                      ))}
                                    </div>
                                    {unit.resources.length > 4 && (
                                      <p className="text-xs text-gray-500 italic text-center mt-2">
                                        + {unit.resources.length - 4} more resources available
                                      </p>
                                    )}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}

                      {subjectData.units.length > 3 && (
                        <p className="text-sm text-gray-500 italic text-center py-4">
                          + {subjectData.units.length - 3} more units available in your personalized plan
                        </p>
                      )}
                    </div>

                    {/* Alberta Documents - Moved to bottom */}
                    {subjectData.albertaDocs && subjectData.albertaDocs.length > 0 && (
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mt-6">
                        <div className="flex items-center gap-2 mb-3">
                          <FileText className="w-4 h-4 text-blue-600" />
                          <h4 className="text-sm font-semibold text-blue-900">Official Alberta Documents</h4>
                        </div>
                        <div className="space-y-2">
                          {subjectData.albertaDocs.map((doc, idx) => (
                            <a
                              key={idx}
                              href={doc.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-2 px-3 py-2 bg-white hover:bg-blue-50 border border-blue-200 rounded-md transition-colors group text-sm"
                            >
                              <span className="flex-1 text-gray-900 group-hover:text-blue-700">
                                {doc.title}
                              </span>
                              <ExternalLink className="w-3.5 h-3.5 text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity" />
                            </a>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </motion.div>
            </AnimatePresence>
          </div>
        </ScrollReveal>

        {/* CTA */}
        <div className="text-center mt-12">
          <Link
            href="/curriculum"
            className="inline-block bg-white hover:bg-gray-50 text-blue-600 font-semibold text-lg px-10 py-4 rounded-lg shadow-xl border-2 border-blue-200 transition-all hover:scale-105"
          >
            Browse All Subjects
          </Link>
        </div>
      </div>
    </section>
  );
}
