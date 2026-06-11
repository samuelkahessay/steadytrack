'use client';

import { ArrowRight, BookOpen } from 'lucide-react';
import { getSubjectIcon, getSubjectColors } from '@/lib/utils/curriculum';

interface NextUpCardProps {
  unitTitle: string;
  subject: string;
  estimatedHours: number | undefined;
  onStartStudying: () => void;
}

export default function NextUpCard({
  unitTitle,
  subject,
  estimatedHours,
  onStartStudying,
}: NextUpCardProps) {
  const colors = getSubjectColors(subject);

  return (
    <div className={`${colors.bg} border-2 ${colors.border} rounded-xl p-6`}>
      <div className="flex flex-col sm:flex-row sm:items-start gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <BookOpen className={`w-4 h-4 ${colors.text}`} />
            <span className={`text-xs font-semibold ${colors.text} uppercase tracking-wide`}>
              Next Up
            </span>
          </div>
          <h3 className="text-base font-semibold text-gray-900 mb-1">
            {unitTitle}
          </h3>
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <span>{getSubjectIcon(subject)}</span>
            <span>{subject}</span>
            {estimatedHours && (
              <>
                <span className="text-gray-400">•</span>
                <span>{estimatedHours}h</span>
              </>
            )}
          </div>
        </div>
        <button
          type="button"
          onClick={onStartStudying}
          className={`w-full sm:w-auto px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg hover:from-blue-700 hover:to-blue-800 transition-all shadow-sm hover:shadow-md flex items-center justify-center gap-2 text-sm font-medium min-h-[44px]`}
        >
          Start
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
