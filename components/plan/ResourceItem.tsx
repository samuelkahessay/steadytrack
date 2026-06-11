'use client';

import { useState, useCallback } from 'react';
import { ExternalLink, CheckCircle } from 'lucide-react';
import { InlineMicrocard } from './InlineMicrocard';
import * as progressStorage from '@/lib/storage/progress';
import type { ContentMicrocard } from '@/lib/types';

interface ResourceItemProps {
  planId: string;
  unitId: string;
  resource: {
    title: string;
    url: string;
    type?: string;
  };
  microcard?: ContentMicrocard;
  isCompleted: boolean;
  onProgressChange: () => void;
}

export function ResourceItem({
  planId,
  unitId,
  resource,
  microcard,
  isCompleted,
  onProgressChange,
}: ResourceItemProps) {
  const [localCompleted, setLocalCompleted] = useState(isCompleted);

  const handleToggleComplete = useCallback(() => {
    if (localCompleted) {
      // Mark incomplete
      progressStorage.deleteResourceProgress(planId, unitId, resource.url);
      setLocalCompleted(false);
    } else {
      // Mark complete
      progressStorage.markResourceComplete({
        plan_id: planId,
        unit_id: unitId,
        resource_url: resource.url,
      });
      setLocalCompleted(true);
    }
    onProgressChange();
  }, [localCompleted, planId, unitId, resource.url, onProgressChange]);

  const handleMicrocardComplete = useCallback(() => {
    // Mark resource complete automatically when microcard is answered correctly
    if (!localCompleted) {
      progressStorage.markResourceComplete({
        plan_id: planId,
        unit_id: unitId,
        resource_url: resource.url,
      });
      setLocalCompleted(true);
      onProgressChange();
    }
  }, [localCompleted, planId, unitId, resource.url, onProgressChange]);

  // If this resource has a microcard, render the interactive quiz
  if (microcard) {
    return (
      <div className="space-y-2">
        <InlineMicrocard
          microcard={microcard}
          planId={planId}
          onComplete={handleMicrocardComplete}
        />
      </div>
    );
  }

  // Otherwise, render as external link with checkbox
  return (
    <div className="flex items-start gap-3 p-3 rounded-lg bg-gray-50 dark:bg-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors group">
      {/* Completion checkbox */}
      <button
        onClick={handleToggleComplete}
        className="flex-shrink-0 mt-0.5"
        aria-label={localCompleted ? 'Mark incomplete' : 'Mark complete'}
      >
        {localCompleted ? (
          <CheckCircle className="w-5 h-5 text-green-600" />
        ) : (
          <div className="w-5 h-5 rounded-full border-2 border-gray-400 dark:border-gray-500 hover:border-green-500 transition-colors" />
        )}
      </button>

      {/* Resource link */}
      <a
        href={resource.url}
        target="_blank"
        rel="noopener noreferrer"
        className="flex-1 flex items-start gap-2 text-sm group"
      >
        <div className="flex-1">
          <p className="font-medium text-gray-900 dark:text-gray-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
            {resource.title}
          </p>
          {resource.type && (
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              {resource.type}
            </p>
          )}
        </div>
        <ExternalLink className="w-4 h-4 text-gray-400 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors flex-shrink-0 mt-0.5" />
      </a>
    </div>
  );
}
