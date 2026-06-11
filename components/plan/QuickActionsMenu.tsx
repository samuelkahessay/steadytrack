'use client';

import { useState } from 'react';
import { BookOpen } from 'lucide-react';
import OutcomeGroup, { Outcome } from './OutcomeGroup';

interface QuickActionsMenuProps {
  subject: string;
  outcomes: Outcome[] | undefined;
}

export default function QuickActionsMenu({
  subject,
  outcomes,
}: QuickActionsMenuProps) {
  const [showOutcomes, setShowOutcomes] = useState(false);

  if (!outcomes || outcomes.length === 0) return null;

  return (
    <>
      {/* Alberta Curriculum Button */}
      <button
        onClick={() => setShowOutcomes(true)}
        className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors group/curriculum"
        aria-label="Alberta Curriculum Outcomes"
        title="Alberta Curriculum"
      >
        <BookOpen className="w-4 h-4 text-blue-600 group-hover/curriculum:text-blue-700" />
      </button>

      {/* Outcomes Modal */}
      {showOutcomes && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[80vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">
                    Alberta Curriculum Outcomes
                  </h3>
                  <p className="text-sm text-gray-600 mt-1">
                    {subject}
                  </p>
                </div>
                <button
                  onClick={() => setShowOutcomes(false)}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
            <div className="px-6 py-4">
              <OutcomeGroup outcomes={outcomes} />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
