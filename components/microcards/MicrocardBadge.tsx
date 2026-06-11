'use client';

import { useState } from 'react';
import { Lightbulb, Loader2 } from 'lucide-react';
import MicrocardModal from './MicrocardModal';
import { useMicrocards } from '@/lib/hooks/useMicrocards';

interface MicrocardBadgeProps {
  subject: string;
  outcomeCodes: string[];
  planId?: string;
  className?: string;
}

export default function MicrocardBadge({
  subject,
  outcomeCodes,
  planId,
  className = '',
}: MicrocardBadgeProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const { microcards, loading } = useMicrocards(
    isModalOpen ? subject : null, // Only fetch when modal is opened
    isModalOpen ? outcomeCodes : []
  );

  const handleOpen = () => {
    setIsModalOpen(true);
  };

  const handleClose = () => {
    setIsModalOpen(false);
  };

  // Don't show badge if no outcomes
  if (outcomeCodes.length === 0) {
    return null;
  }

  return (
    <>
      <button
        onClick={handleOpen}
        className={`
          inline-flex items-center gap-2 px-3 py-1.5 rounded-full
          bg-gradient-to-r from-blue-50 to-purple-50
          border border-blue-200
          hover:from-blue-100 hover:to-purple-100
          hover:border-blue-300
          transition-all duration-200 hover:scale-105
          text-sm font-medium text-blue-700
          ${className}
        `}
      >
        <Lightbulb className="w-4 h-4" />
        <span>Quick Help</span>
        {loading && <Loader2 className="w-3 h-3 animate-spin" />}
        {!loading && microcards.length > 0 && (
          <span className="px-1.5 py-0.5 bg-blue-200 text-blue-800 text-xs font-bold rounded-full">
            {microcards.length}
          </span>
        )}
      </button>

      {/* Modal */}
      {isModalOpen && !loading && microcards.length > 0 && (
        <MicrocardModal
          isOpen={isModalOpen}
          onClose={handleClose}
          microcards={microcards}
          {...(planId ? { planId } : {})}
        />
      )}

      {/* Empty State (if no microcards found) */}
      {isModalOpen && !loading && microcards.length === 0 && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-sm mx-4 text-center">
            <p className="text-gray-700 mb-4">
              No concept cards available yet for these outcomes.
            </p>
            <button
              onClick={handleClose}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </>
  );
}
