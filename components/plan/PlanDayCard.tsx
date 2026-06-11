'use client';

import { useState, useEffect } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import UnitCheckbox from './UnitCheckbox';
import CircularProgress from './CircularProgress';
import { CurriculumResource } from '@/lib/types';
import { getSubjectIcon } from '@/lib/utils/curriculum';
import { get, set } from '@/lib/storage/local';

interface DayUnit {
  subject: string;
  unitId: string;
  title: string;
  estimatedHours?: number;
  resources?: CurriculumResource[];
  outcomes?: Array<{
    code: string;
    description?: string;
    title?: string;
    strand?: string;
  }>;
}

interface PlanDayCardProps {
  dayLabel: string;
  units: DayUnit[];
  allSubjects: string[];
  completedUnitIds: Set<string>;
  submittingUnits: Set<string>;
  onToggleUnit: (unitId: string, subject: string) => void;
  onSetUnitCompletion?: (unitId: string, subject: string, completed: boolean) => void;
  completedResourceUrls: Set<string>;
  onResourceToggle: (unitId: string, resourceUrl: string, completed: boolean) => void;
  // Optional enhanced handler that includes subject to disambiguate units
  onResourceToggleWithSubject?: (
    unitId: string,
    subject: string,
    resourceUrl: string,
    completed: boolean
  ) => void;
  planId?: string;
  highlightedUnitId?: string | null;
}

export default function PlanDayCard({
  dayLabel,
  units,
  allSubjects,
  completedUnitIds,
  submittingUnits,
  onToggleUnit,
  onSetUnitCompletion,
  completedResourceUrls,
  onResourceToggle,
  onResourceToggleWithSubject,
  planId,
  highlightedUnitId,
}: PlanDayCardProps) {
  // Group units by subject
  const unitsBySubject: Record<string, DayUnit[]> = {};
  units.forEach((unit) => {
    if (!unitsBySubject[unit.subject]) {
      unitsBySubject[unit.subject] = [];
    }
    unitsBySubject[unit.subject].push(unit);
  });

  const completedCount = units.filter((u) => completedUnitIds.has(u.unitId)).length;
  const totalCount = units.length;
  const progressPercentage = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
  const isFullyCompleted = progressPercentage === 100;

  // Check if this day contains the highlighted unit
  const hasHighlightedUnit = highlightedUnitId && units.some(u => u.unitId === highlightedUnitId);

  // Collapsible state with localStorage
  const storageKey = `plan-day-collapsed-${dayLabel}`;
  const [isCollapsed, setIsCollapsed] = useState<boolean>(() => {
    // Auto-expand if this day has the highlighted unit
    if (hasHighlightedUnit) return false;

    // Auto-collapse completed days by default
    const stored = get(storageKey, null);
    if (stored !== null) {
      return stored === 'true';
    }
    // Default: collapse if fully completed
    return isFullyCompleted;
  });

  // Auto-expand if highlighted unit is in this day
  useEffect(() => {
    if (hasHighlightedUnit) {
      setIsCollapsed(false);
    }
  }, [hasHighlightedUnit]);

  // Update collapsed state when completion changes
  useEffect(() => {
    const stored = get(storageKey, null);
    // If user hasn't manually set a preference, auto-collapse when completed
    if (stored === null && isFullyCompleted) {
      setIsCollapsed(true);
    }
  }, [isFullyCompleted, storageKey]);

  const toggleCollapse = () => {
    const newState = !isCollapsed;
    setIsCollapsed(newState);
    set(storageKey, String(newState));
  };

  return (
    <Card className="h-full transition-shadow hover:shadow-md overflow-hidden">
      <CardHeader className="pb-4">
        <button
          onClick={toggleCollapse}
          className="w-full flex items-center justify-between gap-4 -m-4 p-4 hover:bg-gray-50 active:bg-gray-100 transition-colors rounded-t-2xl min-h-[60px]"
          aria-expanded={!isCollapsed}
          aria-label={isCollapsed ? `Expand ${dayLabel}` : `Collapse ${dayLabel}`}
        >
          <div className="flex-1 text-left">
            <div className="flex items-center gap-2">
              <CardTitle className="text-base sm:text-lg font-semibold text-gray-900">{dayLabel}</CardTitle>
              {isFullyCompleted && (
                <span className="text-green-500 text-sm">✓</span>
              )}
            </div>
            {totalCount > 0 && (
              <p className="text-xs sm:text-sm text-gray-500 mt-1">
                {completedCount} of {totalCount} completed
              </p>
            )}
          </div>
          {/* Circular Progress & Chevron */}
          <div className="flex items-center gap-3">
            {totalCount > 0 && (
              <CircularProgress percentage={progressPercentage} size={56} strokeWidth={5} />
            )}
            <div className="flex-shrink-0">
              {isCollapsed ? (
                <ChevronDown className="w-5 h-5 text-gray-600 transition-transform" />
              ) : (
                <ChevronUp className="w-5 h-5 text-gray-600 transition-transform" />
              )}
            </div>
          </div>
        </button>
      </CardHeader>

      {!isCollapsed && (
        <CardContent className="pt-0 animate-in fade-in slide-in-from-top-2 duration-200">
        <div className="space-y-3">
          {allSubjects.map((subject) => {
            const subjectUnits = unitsBySubject[subject] || [];

            if (subjectUnits.length === 0) return null;

            return (
              <div key={subject}>
                {/* Subject Header - Compact */}
                <div className="flex items-center gap-1.5 mb-2 px-1">
                  <span className="text-sm">{getSubjectIcon(subject)}</span>
                  <h3 className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
                    {subject}
                  </h3>
                </div>

                {/* Units for this subject */}
                <div className="space-y-1">
                  {subjectUnits.map((unit) => (
                    <UnitCheckbox
                      key={unit.unitId}
                      unitId={unit.unitId}
                      subject={unit.subject}
                      title={unit.title}
                      {...(unit.estimatedHours !== undefined
                        ? { estimatedHours: unit.estimatedHours }
                        : {})}
                      {...(unit.resources ? { resources: unit.resources } : {})}
                      {...(unit.outcomes ? { outcomes: unit.outcomes } : {})}
                      isCompleted={completedUnitIds.has(unit.unitId)}
                      isSubmitting={submittingUnits.has(unit.unitId)}
                      onToggle={onToggleUnit}
                      {...(onSetUnitCompletion ? { onSetCompletion: onSetUnitCompletion } : {})}
                      completedResourceUrls={completedResourceUrls}
                      onResourceToggle={(unitId, resourceUrl, completed) => {
                        if (onResourceToggleWithSubject) {
                          onResourceToggleWithSubject(unitId, unit.subject, resourceUrl, completed);
                        } else {
                          onResourceToggle(unitId, resourceUrl, completed);
                        }
                      }}
                      {...(planId ? { planId } : {})}
                      isHighlighted={unit.unitId === highlightedUnitId}
                    />
                  ))}
                </div>
              </div>
            );
          })}

          {totalCount === 0 && (
            <p className="text-sm text-gray-500 text-center py-4">No units scheduled</p>
          )}
        </div>
        </CardContent>
      )}
    </Card>
  );
}
