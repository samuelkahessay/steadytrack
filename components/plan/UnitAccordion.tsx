'use client';

import { useState, useMemo } from 'react';
import { ChevronRight, BookOpen } from 'lucide-react';
import { motion } from 'framer-motion';
import { OutcomeCard } from './OutcomeCard';
import type { LearningOutcome } from '@/types/database';

interface UnitAccordionProps {
  planId: string;
  unit: {
    unitId: string;
    unitTitle: string;
    subject: string;
  };
  outcomes: LearningOutcome[];
  completedResourceUrls: Set<string>;
  onProgressChange: () => void;
}

/**
 * UnitAccordion - Displays a collapsible unit with its learning outcomes
 *
 * Simplified from 222 lines → ~80 lines by delegating to OutcomeCard
 */
export function UnitAccordion({
  planId,
  unit,
  outcomes,
  completedResourceUrls,
  onProgressChange,
}: UnitAccordionProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  // Calculate progress by checking completion of each outcome's resources
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

      // Also count fallback resources
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

  // Don't render if no outcomes
  if (outcomes.length === 0) {
    return null;
  }

  return (
    <div className="border rounded-lg overflow-hidden bg-white dark:bg-gray-800 shadow-sm hover:shadow-md transition-shadow duration-200">
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center gap-3 p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-all duration-200 text-left"
      >
        {/* Expand icon with rotation animation */}
        <motion.div
          animate={{ rotate: isExpanded ? 90 : 0 }}
          transition={{ duration: 0.2, ease: 'easeInOut' }}
        >
          <ChevronRight className="w-5 h-5 text-gray-500 flex-shrink-0" />
        </motion.div>

        {/* Unit icon */}
        <BookOpen className="w-5 h-5 text-blue-600 flex-shrink-0" />

        {/* Unit info */}
        <div className="flex-1 min-w-0">
          <p className="font-medium text-gray-900 dark:text-gray-100 truncate mb-2">
            {unit.unitTitle}
          </p>

          {/* Progress bar */}
          <div className="flex items-center gap-3">
            <div className="flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all duration-500 ease-out ${
                  completedCount === totalCount && totalCount > 0
                    ? 'bg-gradient-to-r from-green-500 to-emerald-500'
                    : 'bg-gradient-to-r from-blue-500 to-indigo-500'
                }`}
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <span className="text-xs font-medium text-gray-600 dark:text-gray-400 flex-shrink-0 min-w-[3rem] text-right">
              {completedCount}/{totalCount}
            </span>
          </div>
        </div>

        {/* Completion badge */}
        {completedCount === totalCount && totalCount > 0 && (
          <div className="flex-shrink-0 text-green-600 dark:text-green-400 font-semibold text-sm">
            ✓
          </div>
        )}
      </button>

      {/* Content with smooth animation */}
      {isExpanded && (
        <div className="border-t bg-gray-50 dark:bg-gray-900/50">
          <div className="p-4 space-y-4">
            {outcomes.map((outcome) => (
              <OutcomeCard
                key={outcome.outcomeCode}
                planId={planId}
                outcome={outcome}
                completedResourceUrls={completedResourceUrls}
                onProgressChange={onProgressChange}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
