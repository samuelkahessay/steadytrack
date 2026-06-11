'use client';

import { useState, useMemo } from 'react';
import {
  ChevronDown,
  ChevronUp,
  Target,
  FileText,
  Clock,
  ExternalLink,
} from 'lucide-react';
import { CurriculumUnit } from '@/types/database';
import { cleanResourceTitle } from '@/lib/utils/title';
import { useMicrocards } from '@/lib/hooks/useMicrocards';
import OutcomeMicrocardCard from './OutcomeMicrocardCard';

interface UnitAccordionProps {
  unit: CurriculumUnit;
  subject: string; // Add subject for fetching microcards
  isInitiallyExpanded?: boolean;
}

export default function UnitAccordion({
  unit,
  subject,
  isInitiallyExpanded = false,
}: UnitAccordionProps) {
  const [isExpanded, setIsExpanded] = useState(isInitiallyExpanded);
  const [showResources, setShowResources] = useState(false);

  const outcomeCount = unit.outcomes?.length || 0;
  const resourceCount = unit.resources?.length || 0;

  // Extract outcome codes for microcard fetching (memoized to prevent infinite re-renders)
  const outcomeCodes = useMemo(
    () => unit.outcomes?.map((o) => o.code) || [],
    [unit.outcomes]
  );

  // Fetch microcards for all outcomes in this unit (only when expanded)
  const { microcards, loading: microcardsLoading } = useMicrocards(
    isExpanded ? subject : null,
    isExpanded ? outcomeCodes : []
  );

  // Create a map of outcome code -> microcard for easy lookup
  const microcardMap = new Map(
    microcards.map((mc) => [mc.outcome_code, mc])
  );

  return (
    <div
      id={unit.id}
      className="border border-gray-200 rounded-lg overflow-hidden hover:border-blue-300 transition-colors scroll-mt-4"
    >
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-5 py-4 bg-white hover:bg-gray-50 transition-colors text-left"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <h3 className="font-semibold text-lg text-gray-900 mb-2">{unit.title}</h3>

            {/* Topics */}
            {unit.topics && unit.topics.length > 0 && (
              <p className="text-sm text-gray-600 mb-3 line-clamp-2">
                {unit.topics.join(' • ')}
              </p>
            )}

            {/* Stats badges */}
            <div className="flex flex-wrap gap-2">
              {unit.estimatedHours && (
                <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full font-medium inline-flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  ~{unit.estimatedHours}h
                </span>
              )}
              <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full font-medium inline-flex items-center gap-1">
                <Target className="w-3 h-3" />
                {outcomeCount} outcome{outcomeCount !== 1 ? 's' : ''}
              </span>
              <span className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded-full font-medium inline-flex items-center gap-1">
                <FileText className="w-3 h-3" />
                {resourceCount} resource{resourceCount !== 1 ? 's' : ''}
              </span>
            </div>
          </div>

          {/* Toggle icon */}
          {isExpanded ? (
            <ChevronUp className="w-5 h-5 text-gray-400 flex-shrink-0 mt-1" />
          ) : (
            <ChevronDown className="w-5 h-5 text-gray-400 flex-shrink-0 mt-1" />
          )}
        </div>
      </button>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="border-t border-gray-200 bg-gray-50 p-5">
          {/* Outcomes */}
          {unit.outcomes && unit.outcomes.length > 0 && (
            <div className="mb-6">
              <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                <Target className="w-4 h-4 text-green-600" />
                Alberta Curriculum Outcomes
              </h4>
              <div className="space-y-6">
                {unit.outcomes.map((outcome, idx) => (
                  <div key={idx}>
                    {/* Outcome Header */}
                    <div className="bg-white p-4 rounded-lg border border-gray-200 hover:border-green-300 transition-colors mb-3">
                      <div className="flex items-start gap-3">
                        <span className="flex-shrink-0 font-mono text-sm font-bold text-green-600 bg-green-50 px-2 py-1 rounded">
                          {outcome.code}
                        </span>
                        <div className="flex-1 min-w-0">
                          {(outcome.description || outcome.title) && (
                            <p className="text-sm text-gray-700 leading-relaxed">
                              {outcome.description || outcome.title}
                            </p>
                          )}
                          {outcome.category && (
                            <span className="inline-block mt-2 text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
                              {outcome.category}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Microcard Card (Primary Learning Content) */}
                    {/* Only show if loading or if a microcard exists */}
                    {(microcardsLoading || microcardMap.get(outcome.code)) && (
                      <OutcomeMicrocardCard
                        microcard={microcardMap.get(outcome.code) || null}
                        outcomeCode={outcome.code}
                        subject={subject}
                        loading={microcardsLoading}
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Resources - Collapsible Secondary Section */}
          {unit.resources && unit.resources.length > 0 && (
            <div className="mt-6 border-t border-gray-300 pt-6">
              <button
                onClick={() => setShowResources(!showResources)}
                className="w-full flex items-center justify-between mb-3 hover:bg-gray-100 rounded-lg p-2 transition-colors"
              >
                <h4 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                  <FileText className="w-4 h-4 text-purple-600" />
                  Additional Resources ({resourceCount})
                </h4>
                {showResources ? (
                  <ChevronUp className="w-5 h-5 text-gray-400" />
                ) : (
                  <ChevronDown className="w-5 h-5 text-gray-400" />
                )}
              </button>

              {showResources && (
                <div>
                  <p className="text-xs text-gray-600 mb-3 italic">
                    📚 Supplementary materials for deeper learning (external links)
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {unit.resources.map((resource, idx) => (
                      <a
                        key={idx}
                        href={resource.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="bg-white p-4 rounded-lg border border-gray-200 hover:border-purple-300 hover:shadow-md transition-all group"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <h5 className="font-medium text-gray-900 group-hover:text-purple-600 mb-2 line-clamp-2 text-sm">
                              {cleanResourceTitle(resource.title, resource.url)}
                            </h5>
                            <div className="flex flex-wrap gap-1.5">
                              <span
                                className={`px-2 py-0.5 rounded text-xs font-medium ${
                                  resource.type === 'video'
                                    ? 'bg-red-100 text-red-700'
                                    : resource.type === 'article'
                                    ? 'bg-blue-100 text-blue-700'
                                    : resource.type === 'practice'
                                    ? 'bg-green-100 text-green-700'
                                    : resource.type === 'simulation'
                                    ? 'bg-purple-100 text-purple-700'
                                    : 'bg-gray-100 text-gray-700'
                                }`}
                              >
                                {resource.type}
                              </span>
                              {resource.difficulty && (
                                <span className="px-2 py-0.5 rounded text-xs font-medium bg-orange-100 text-orange-700">
                                  {resource.difficulty}
                                </span>
                              )}
                            </div>
                            {resource.alignedOutcomes && resource.alignedOutcomes.length > 0 && (
                              <div className="mt-2">
                                <p className="text-xs text-gray-500">
                                  Aligned: {resource.alignedOutcomes.join(', ')}
                                </p>
                              </div>
                            )}
                          </div>
                          <ExternalLink className="w-4 h-4 text-gray-400 group-hover:text-purple-600 flex-shrink-0 transition-colors" />
                        </div>
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
