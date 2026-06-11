'use client';

import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { motion } from 'framer-motion';
import { getAllSubjectsWithMetadata, getSubjectColors } from '@/lib/utils/curriculum';
import { ScrollReveal, StaggerContainer } from '@/components/motion';
import { staggerChildVariants } from '@/components/motion/StaggerContainer';

export default function SubjectBrowser() {
  const subjects = getAllSubjectsWithMetadata();

  // Group subjects by grade
  const grade11 = subjects.filter(s => s.grade === 11);
  const grade12 = subjects.filter(s => s.grade === 12);

  return (
    <section className="py-16 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <ScrollReveal direction="up">
          <div className="text-center mb-12">
            <h2 className="font-display text-3xl sm:text-4xl font-extrabold tracking-tight text-gray-900 mb-3">
              Browse by Subject
            </h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              Explore curriculum outcomes, resources, and study materials for each subject
            </p>
          </div>
        </ScrollReveal>

        {/* Grade 11 Subjects */}
        <div className="mb-12">
          <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
            <span className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-sm">Grade 11</span>
          </h3>
          <StaggerContainer staggerDelay={0.08} className="grid grid-cols-2 sm:grid-cols-6 gap-4">
            {grade11.map((subject) => {
              const colors = getSubjectColors(subject.name);
              return (
                <motion.div
                  key={subject.slug}
                  variants={staggerChildVariants}
                  whileHover={{ y: -2 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                >
                  <Link
                    href={`/curriculum/${subject.slug}`}
                    className="group block relative bg-gradient-to-br from-white to-gray-50 border-2 border-gray-200 rounded-xl overflow-hidden hover:border-blue-400 hover:shadow-lg transition-all"
                  >
                    {/* Accent bar */}
                    <div className={`h-1 ${colors.dot}`} />
                    {/* Watermark emoji */}
                    <div className="absolute top-2 right-2 text-3xl opacity-[0.06] pointer-events-none select-none">
                      {subject.icon}
                    </div>
                    <div className="text-center p-4 pt-3">
                      <div className="text-4xl mb-2">{subject.icon}</div>
                      <h4 className="font-display font-semibold text-sm text-gray-900 mb-1 line-clamp-2 min-h-[2.5rem]">
                        {subject.name}
                      </h4>
                      <p className="text-xs text-gray-500 mb-2">
                        {subject.totalOutcomes} outcomes
                      </p>
                      <div className="flex items-center justify-center text-blue-600 text-xs font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                        View
                        <ChevronRight className="w-3 h-3 ml-0.5" />
                      </div>
                    </div>
                  </Link>
                </motion.div>
              );
            })}
          </StaggerContainer>
        </div>

        {/* Grade 12 Subjects */}
        <div>
          <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
            <span className="bg-purple-100 text-purple-700 px-3 py-1 rounded-full text-sm">Grade 12</span>
            <span className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-xs">Diploma Exams</span>
          </h3>
          <StaggerContainer staggerDelay={0.08} className="grid grid-cols-2 sm:grid-cols-6 gap-4">
            {grade12.map((subject) => {
              const colors = getSubjectColors(subject.name);
              return (
                <motion.div
                  key={subject.slug}
                  variants={staggerChildVariants}
                  whileHover={{ y: -2 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                >
                  <Link
                    href={`/curriculum/${subject.slug}`}
                    className="group block relative bg-gradient-to-br from-white to-purple-50 border-2 border-purple-200 rounded-xl overflow-hidden hover:border-purple-400 hover:shadow-lg transition-all"
                  >
                    {/* Accent bar */}
                    <div className={`h-1 ${colors.dot}`} />
                    {/* Watermark emoji */}
                    <div className="absolute top-2 right-2 text-3xl opacity-[0.06] pointer-events-none select-none">
                      {subject.icon}
                    </div>
                    <div className="text-center p-4 pt-3">
                      <div className="text-4xl mb-2">{subject.icon}</div>
                      <h4 className="font-display font-semibold text-sm text-gray-900 mb-1 line-clamp-2 min-h-[2.5rem]">
                        {subject.name}
                      </h4>
                      <p className="text-xs text-gray-500 mb-2">
                        {subject.totalOutcomes} outcomes
                      </p>
                      <div className="flex items-center justify-center text-purple-600 text-xs font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                        View
                        <ChevronRight className="w-3 h-3 ml-0.5" />
                      </div>
                    </div>
                  </Link>
                </motion.div>
              );
            })}
          </StaggerContainer>
        </div>

        {/* View All CTA */}
        <div className="mt-10 text-center">
          <Link
            href="/curriculum"
            className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold px-8 py-3 rounded-lg shadow-lg transition-all hover:scale-105"
          >
            View All Subjects
            <ChevronRight className="w-5 h-5" />
          </Link>
        </div>
      </div>
    </section>
  );
}
