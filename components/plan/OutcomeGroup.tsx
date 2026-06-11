'use client';

import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';

export interface Outcome {
  code: string;
  description?: string;
  title?: string;
  strand?: string;
  type?: string;
  category?: string;
  parent?: string;
}

interface OutcomeGroupProps {
  outcomes: Outcome[];
}

interface GroupedOutcomes {
  general: Outcome;
  specific: Outcome[];
}

export default function OutcomeGroup({ outcomes }: OutcomeGroupProps) {
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  // Group outcomes by parent (general outcomes)
  const groupedOutcomes: GroupedOutcomes[] = [];
  const generalOutcomes = outcomes.filter((o) => o.type === 'general');

  generalOutcomes.forEach((general) => {
    const specific = outcomes.filter((o) => o.parent === general.code);
    groupedOutcomes.push({ general, specific });
  });

  // Handle ungrouped specific outcomes (if any don't have a parent in the list)
  const ungroupedSpecific = outcomes.filter(
    (o) => o.type !== 'general' && !generalOutcomes.some((g) => g.code === o.parent)
  );

  const toggleGroup = (code: string) => {
    const newExpanded = new Set(expandedGroups);
    if (newExpanded.has(code)) {
      newExpanded.delete(code);
    } else {
      newExpanded.add(code);
    }
    setExpandedGroups(newExpanded);
  };

  if (outcomes.length === 0) return null;

  return (
    <div className="space-y-2">
      {groupedOutcomes.map((group) => {
        const isExpanded = expandedGroups.has(group.general.code);
        const hasSpecific = group.specific.length > 0;

        return (
          <div key={group.general.code} className="border-l-2 border-blue-300 pl-3">
            <div className="flex items-start gap-2">
              {hasSpecific && (
                <button
                  onClick={() => toggleGroup(group.general.code)}
                  className="flex-shrink-0 mt-0.5 hover:bg-blue-100 rounded p-0.5 transition-colors"
                >
                  {isExpanded ? (
                    <ChevronDown className="w-4 h-4 text-blue-600" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-blue-600" />
                  )}
                </button>
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2 flex-wrap">
                  <span className="font-semibold text-blue-800 text-sm">
                    {group.general.code}
                  </span>
                  {hasSpecific && (
                    <span className="text-xs text-gray-500">
                      ({group.specific.length} specific outcomes)
                    </span>
                  )}
                </div>
                <p className="text-sm text-gray-700 mt-0.5">
                  {group.general.description || group.general.title}
                </p>
              </div>
            </div>

            {/* Specific outcomes */}
            {isExpanded && hasSpecific && (
              <div className="mt-2 ml-6 space-y-2 pb-2">
                {group.specific.map((outcome) => (
                  <div key={outcome.code} className="flex items-start gap-2">
                    <span className="font-mono text-xs text-blue-600 font-medium flex-shrink-0 mt-0.5">
                      {outcome.code}
                    </span>
                    <p className="text-xs text-gray-600 flex-1">
                      {outcome.description || outcome.title}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}

      {/* Ungrouped specific outcomes (if any) */}
      {ungroupedSpecific.length > 0 && (
        <div className="space-y-1.5">
          {ungroupedSpecific.map((outcome) => (
            <div key={outcome.code} className="flex items-start gap-2 pl-3">
              <span className="font-mono text-xs text-blue-700 font-semibold flex-shrink-0">
                {outcome.code}
              </span>
              <p className="text-sm text-gray-700">
                {outcome.description || outcome.title}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
