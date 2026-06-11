'use client';

import { useState, useMemo } from 'react';
import { ChevronRight, Calendar } from 'lucide-react';
import { motion } from 'framer-motion';
import { UnitAccordion } from './UnitAccordion';
import { getSubjectIcon } from '@/lib/utils/curriculum';
import type { LearningOutcome } from '@/types/database';

interface DayAccordionProps {
  planId: string;
  dayNumber: number;
  date: string; // YYYY-MM-DD format
  dayLabel: string;
  outcomes: LearningOutcome[];
  completedResourceUrls: Set<string>;
  onProgressChange: () => void;
}

/**
 * DayAccordion - Displays a single day with its learning outcomes
 *
 * Groups outcomes by (subject, unit) for hierarchical display
 */
export function DayAccordion({
  planId,
  dayNumber,
  date: _date,
  dayLabel,
  outcomes,
  completedResourceUrls,
  onProgressChange,
}: DayAccordionProps) {
  const [isExpanded, setIsExpanded] = useState(dayNumber === 1); // Expand Day 1 by default

  // Group outcomes by (subject, unitId) for accordion display
  const unitGroups = useMemo(() => {
    const groups = new Map<string, {
      subject: string;
      unitId: string;
      unitTitle: string;
      outcomes: LearningOutcome[];
    }>();

    outcomes.forEach((outcome) => {
      const key = `${outcome.subject}:${outcome.unitId}`;
      if (!groups.has(key)) {
        groups.set(key, {
          subject: outcome.subject,
          unitId: outcome.unitId,
          unitTitle: outcome.unitTitle,
          outcomes: [],
        });
      }
      groups.get(key)!.outcomes.push(outcome);
    });

    // Group units by subject for hierarchical display
    const subjectGroups = new Map<string, typeof groups extends Map<string, infer T> ? T[] : never>();
    for (const [, group] of groups) {
      if (!subjectGroups.has(group.subject)) {
        subjectGroups.set(group.subject, []);
      }
      subjectGroups.get(group.subject)!.push(group);
    }

    return subjectGroups;
  }, [outcomes]);

  // Calculate total progress across all outcomes
  const { completedCount, totalCount } = useMemo(() => {
    let completed = 0;
    let total = 0;

    outcomes.forEach((outcome) => {
      // Check microcard completion
      const microcardUrl = `microcard:${outcome.outcomeCode}`;
      if (completedResourceUrls.has(microcardUrl)) {
        completed++;
      }
      total++;

      // Count fallback resources
      outcome.fallbackResources.forEach((resource) => {
        if (completedResourceUrls.has(resource.url)) {
          completed++;
        }
        total++;
      });
    });

    return { completedCount: completed, totalCount: total };
  }, [outcomes, completedResourceUrls]);

  const progressPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  // Skip rendering if no outcomes
  if (outcomes.length === 0) {
    return null;
  }

  return (
    <div className="border rounded-xl overflow-hidden bg-white dark:bg-gray-800 shadow-sm hover:shadow-lg transition-shadow duration-300">
      {/* Day Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center gap-3 p-5 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-all duration-200 text-left"
      >
        {/* Expand icon with rotation animation */}
        <motion.div
          animate={{ rotate: isExpanded ? 90 : 0 }}
          transition={{ duration: 0.2, ease: 'easeInOut' }}
        >
          <ChevronRight className="w-6 h-6 text-gray-500 flex-shrink-0" />
        </motion.div>

        {/* Calendar icon */}
        <Calendar className="w-6 h-6 text-indigo-600 flex-shrink-0" />

        {/* Day info */}
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-lg text-gray-900 dark:text-gray-100 mb-2">
            {dayLabel}
          </p>

          {/* Progress bar */}
          <div className="flex items-center gap-3">
            <div className="flex-1 h-2.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all duration-500 ease-out ${
                  completedCount === totalCount && totalCount > 0
                    ? 'bg-gradient-to-r from-green-500 to-emerald-500'
                    : 'bg-gradient-to-r from-blue-500 to-indigo-500'
                }`}
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <span className="text-sm font-medium text-gray-600 dark:text-gray-400 flex-shrink-0 min-w-[4rem] text-right">
              {completedCount}/{totalCount}
            </span>
          </div>
        </div>

        {/* Completion badge */}
        {completedCount === totalCount && totalCount > 0 && (
          <div className="flex-shrink-0 bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300 px-3 py-1.5 rounded-full text-sm font-semibold">
            ✓ Complete
          </div>
        )}
      </button>

      {/* Subjects and units */}
      {isExpanded && (
        <div className="border-t bg-gray-50 dark:bg-gray-900/50">
          <div className="p-5 space-y-5">
            {Array.from(unitGroups.entries()).map(([subject, units]) => (
              <div key={subject} className="space-y-3">
                {/* Subject header */}
                <div className="flex items-center gap-2">
                  <span className="text-2xl">{getSubjectIcon(subject)}</span>
                  <h3 className="font-semibold text-lg text-gray-900 dark:text-gray-100">
                    {subject}
                  </h3>
                </div>

                {/* Units for this subject */}
                <div className="space-y-3 ml-6">
                  {units.map((unitGroup) => (
                    <UnitAccordion
                      key={unitGroup.unitId}
                      planId={planId}
                      unit={{
                        unitId: unitGroup.unitId,
                        unitTitle: unitGroup.unitTitle,
                        subject: unitGroup.subject,
                      }}
                      outcomes={unitGroup.outcomes}
                      completedResourceUrls={completedResourceUrls}
                      onProgressChange={onProgressChange}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
