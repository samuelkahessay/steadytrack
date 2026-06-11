'use client';

import { useState } from 'react';
import { Lightbulb, ArrowRight, Loader2 } from 'lucide-react';
import MicrocardModal from '@/components/microcards/MicrocardModal';
import type { ContentMicrocard } from '@/lib/types';
import { getSubjectIcon } from '@/lib/utils/curriculum';

interface OutcomeMicrocardCardProps {
  microcard: ContentMicrocard | null;
  outcomeCode: string;
  subject: string;
  loading?: boolean;
}

export default function OutcomeMicrocardCard({
  microcard,
  outcomeCode,
  subject,
  loading = false,
}: OutcomeMicrocardCardProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Loading state
  if (loading) {
    return (
      <div className="bg-gradient-to-br from-blue-50 to-purple-50 border-2 border-blue-200 rounded-xl p-4 mb-4">
        <div className="flex items-center gap-3">
          <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />
          <span className="text-sm text-gray-600">Loading learning content...</span>
        </div>
      </div>
    );
  }

  // No microcard available
  if (!microcard) {
    return (
      <div className="bg-gray-50 border-2 border-dashed border-gray-300 rounded-xl p-4 mb-4">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center">
            <Lightbulb className="w-5 h-5 text-gray-400" />
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="text-sm font-semibold text-gray-700 mb-1">
              Interactive Learning Card
            </h4>
            <p className="text-xs text-gray-500">
              Coming soon for {outcomeCode}
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Truncate summary to ~120 characters
  const truncatedSummary = microcard.summary.length > 120
    ? `${microcard.summary.slice(0, 120)}...`
    : microcard.summary;

  return (
    <>
      <div className="bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 border-2 border-blue-300 rounded-xl p-5 mb-4 hover:border-blue-400 hover:shadow-lg transition-all duration-200 group cursor-pointer">
        <button
          onClick={() => setIsModalOpen(true)}
          className="w-full text-left"
        >
          {/* Header */}
          <div className="flex items-start gap-3 mb-3">
            <div className="flex-shrink-0 w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center shadow-md group-hover:scale-110 transition-transform">
              <Lightbulb className="w-6 h-6 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xl">{getSubjectIcon(subject)}</span>
                <span className="px-2 py-0.5 bg-blue-600 text-white text-xs font-bold rounded">
                  {outcomeCode}
                </span>
              </div>
              <h4 className="text-base font-bold text-gray-900 group-hover:text-blue-700 transition-colors">
                Interactive Learning Card
              </h4>
            </div>
          </div>

          {/* Summary Preview */}
          <div className="mb-4">
            <p className="text-sm text-gray-700 leading-relaxed">
              {truncatedSummary}
            </p>
          </div>

          {/* Features badges */}
          <div className="flex flex-wrap gap-2 mb-4">
            {microcard.steps && microcard.steps.length > 0 && (
              <span className="text-xs bg-white/60 backdrop-blur-sm text-blue-700 px-2 py-1 rounded-full font-medium border border-blue-200">
                🪜 {microcard.steps.length} Steps
              </span>
            )}
            {microcard.quick_check && (
              <span className="text-xs bg-white/60 backdrop-blur-sm text-purple-700 px-2 py-1 rounded-full font-medium border border-purple-200">
                ✓ Quick Check
              </span>
            )}
            {microcard.pitfall && (
              <span className="text-xs bg-white/60 backdrop-blur-sm text-amber-700 px-2 py-1 rounded-full font-medium border border-amber-200">
                ⚠️ Pitfall Alert
              </span>
            )}
          </div>

          {/* CTA */}
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-blue-700 group-hover:text-blue-800 flex items-center gap-2">
              Start Learning
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </span>
            <span className="text-xs text-gray-500">
              Click to learn interactively
            </span>
          </div>
        </button>
      </div>

      {/* Microcard Modal */}
      {isModalOpen && (
        <MicrocardModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          microcards={[microcard]}
          initialIndex={0}
        />
      )}
    </>
  );
}
