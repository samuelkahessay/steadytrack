'use client';

import { useState } from 'react';
import { ChevronDown, ChevronUp, BookOpen } from 'lucide-react';
import OutcomeGroup, { Outcome } from './OutcomeGroup';

interface CurriculumAlignmentBadgeProps {
  outcomes: Outcome[];
}

export default function CurriculumAlignmentBadge({
  outcomes,
}: CurriculumAlignmentBadgeProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  if (!outcomes || outcomes.length === 0) return null;

  return (
    <div className="mt-3">
      {/* Compact Badge */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between px-3 py-2 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg transition-colors text-left"
      >
        <div className="flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-blue-600 flex-shrink-0" />
          <span className="text-sm font-medium text-blue-900">
            Alberta Curriculum
          </span>
          <span className="text-xs text-blue-600 bg-blue-100 px-2 py-0.5 rounded-full">
            {outcomes.length} outcome{outcomes.length !== 1 ? 's' : ''}
          </span>
        </div>
        {isExpanded ? (
          <ChevronUp className="w-4 h-4 text-blue-600 flex-shrink-0" />
        ) : (
          <ChevronDown className="w-4 h-4 text-blue-600 flex-shrink-0" />
        )}
      </button>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="mt-2 p-3 bg-white border border-blue-200 rounded-lg">
          <p className="text-xs text-gray-600 mb-3">
            This unit aligns with the following Alberta Education curriculum outcomes:
          </p>
          <OutcomeGroup outcomes={outcomes} />
        </div>
      )}
    </div>
  );
}
