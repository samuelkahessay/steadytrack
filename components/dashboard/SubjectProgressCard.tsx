'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import ProgressBar from '@/components/dashboard/ProgressBar';
import CurriculumPanel from '@/components/plan/CurriculumPanel';
import { Lightbulb, AlertCircle } from 'lucide-react';
import type { UserProgress } from '@/lib/types';
import { getCurriculumData } from '@/data/curriculum';
import type {
  UnitItem,
  ProgressUpdatePayload,
} from '@/components/dashboard/UnitChecklistClient';
import { getSubjectIcon } from '@/lib/utils/curriculum';
import { cn } from '@/lib/utils';
import { useMicrocardsQuery } from '@/lib/hooks/queries/useMicrocardsQuery';
import { useUnitCompletionQuery } from '@/lib/hooks/queries/useUnitCompletionQuery';
import { useMarkUnitCompleteLocal, useUndoUnitProgressLocal } from '@/lib/hooks/queries/mutations/useProgressMutationLocal';

interface SubjectProgressCardProps {
  subject: string;
  planId: string;
  progress: UserProgress[];
  units: UnitItem[]; // Derived from plan schedule (e.g., today's units)
  onProgressUpdate: (payload: ProgressUpdatePayload) => void;
  albertaDocs?: Array<{ title: string; url: string; type?: string }>;
  totalOutcomes?: number;
}

export default function SubjectProgressCard({
  subject,
  planId,
  progress,
  units,
  onProgressUpdate,
  albertaDocs,
  totalOutcomes,
}: SubjectProgressCardProps) {
  const router = useRouter();

  // Units scheduled (e.g., today) for this subject
  const subjectUnits = useMemo(
    () => units.filter((u) => u.subject === subject),
    [units, subject]
  );

  const completedIds = useMemo(() => new Set(progress.map((p) => p.unit_id)), [
    progress,
  ]);

  const totalUnits = subjectUnits.length;
  const completedUnits = subjectUnits.filter((u) => completedIds.has(u.unitId)).length;
  const hasSchedule = totalUnits > 0;
  const percentage = hasSchedule ? Math.round((completedUnits / totalUnits) * 100) : 0;

  // Expanded state for showing/hiding unit details
  const [isExpanded, setIsExpanded] = useState(false);

  // Collect all outcome codes for microcard fetching
  const allOutcomeCodes = useMemo(() => {
    const curriculumData = getCurriculumData(subject);
    if (!curriculumData) return [];

    const codes: string[] = [];
    for (const unit of subjectUnits) {
      const curriculumUnit = curriculumData.units.find((u) => u.id === unit.unitId);
      if (curriculumUnit?.outcomes) {
        codes.push(...curriculumUnit.outcomes.map((o) => o.code));
      }
    }
    return codes;
  }, [subject, subjectUnits]);

  // Fetch microcards with React Query
  // Replaces manual useEffect (lines 72-134)
  const { data: microcards } = useMicrocardsQuery(
    subject,
    allOutcomeCodes,
    {
      enabled: isExpanded && allOutcomeCodes.length > 0,
    }
  );

  // Organize microcards by unit
  const _unitMicrocards = useMemo(() => {
    if (!microcards) return {};

    const curriculumData = getCurriculumData(subject);
    if (!curriculumData) return {};

    const byUnit: Record<string, typeof microcards> = {};

    for (const unit of subjectUnits) {
      const curriculumUnit = curriculumData.units.find((u) => u.id === unit.unitId);
      if (curriculumUnit?.outcomes) {
        const outcomeCodesForUnit = curriculumUnit.outcomes.map((o) => o.code);
        byUnit[unit.unitId] = microcards.filter((mc) =>
          outcomeCodesForUnit.includes(mc.outcome_code)
        );
      }
    }

    return byUnit;
  }, [microcards, subject, subjectUnits]);

  // Prepare units to check for completion requirements
  const unitsToCheck = useMemo(() => {
    const curriculumData = getCurriculumData(subject);
    if (!curriculumData) return [];

    return subjectUnits
      .filter((u) => !completedIds.has(u.unitId))
      .map((u) => {
        const cu = curriculumData.units.find((x) => x.id === u.unitId);
        return {
          unitId: u.unitId,
          subject,
          outcomeCodes: cu?.outcomes?.map((o) => o.code) || [],
          resourceUrls: cu?.resources?.map((r) => r.url) || [],
        };
      });
  }, [subject, subjectUnits, completedIds]);

  // Check unit completion requirements with React Query
  // Replaces manual useEffect (lines 136-188)
  const { data: completionStatusesMap } = useUnitCompletionQuery({
    subject,
    units: unitsToCheck,
    enabled: isExpanded && unitsToCheck.length > 0,
  });

  // Convert Map to Record for easier access
  const unitCompletionStatuses = useMemo(() => {
    if (!completionStatusesMap) return {};
    const record: Record<string, ReturnType<typeof completionStatusesMap.get>> = {};
    completionStatusesMap.forEach((value, key) => {
      record[key] = value;
    });
    return record;
  }, [completionStatusesMap]);

  // Mutations for marking complete/undoing (localStorage version)
  const markCompleteMutation = useMarkUnitCompleteLocal(planId);
  const undoProgressMutation = useUndoUnitProgressLocal(planId);

  // Handle mutation success
  const handleMarkComplete = (unitId: string, subject: string) => {
    markCompleteMutation.mutate(
      { planId, subject, unitId },
      {
        onSuccess: (response) => {
          onProgressUpdate({
            type: 'completed',
            unitId,
            subject,
            response,
          });
        },
      }
    );
  };

  const handleUndoProgress = (unitId: string) => {
    undoProgressMutation.mutate(
      { planId, unitId },
      {
        onSuccess: () => {
          onProgressUpdate({
            type: 'undone',
            unitId,
            subject,
          });
        },
      }
    );
  };

  const toggleUnit = (unitId: string, nextChecked: boolean) => {
    // Check if this unit is currently being mutated
    const isSubmitting = markCompleteMutation.isPending || undoProgressMutation.isPending;
    if (isSubmitting) return;

    // Check completion requirements before allowing toggle
    if (nextChecked && unitCompletionStatuses[unitId] && !unitCompletionStatuses[unitId].canComplete) {
      // Don't allow marking as complete if requirements aren't met
      return;
    }

    if (nextChecked) {
      handleMarkComplete(unitId, subject);
    } else {
      handleUndoProgress(unitId);
    }
  };

  // Determine status
  let status = '';
  let statusColor = '';

  if (hasSchedule) {
    if (percentage === 100) {
      status = '🎉 Complete';
      statusColor = 'text-green-600';
    } else if (percentage >= 70) {
      status = '✅ On track';
      statusColor = 'text-green-600';
    } else if (percentage < 50) {
      status = '🌱 Small steps add up';
      statusColor = 'text-orange-600';
    } else {
      status = '📈 Making progress';
      statusColor = 'text-blue-600';
    }
  } else {
    // No scheduled work today → do not show pace messaging
    status = '';
  }

  return (
    <>
      <Card className="hover:shadow-lg transition-shadow duration-200">
        {/* Header - Always visible, clickable */}
        <CardHeader
        className="cursor-pointer relative"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <CardTitle className="text-lg flex items-center gap-2">
              <span>{getSubjectIcon(subject)}</span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  router.push(`/curriculum?subject=${encodeURIComponent(subject)}`);
                }}
                className="hover:text-blue-600 hover:underline transition-colors text-left"
              >
                {subject}
              </button>
            </CardTitle>
            {status && (
              <p className={`text-sm font-medium mt-1 ${statusColor}`}>{status}</p>
            )}
          </div>
          {/* Expand/Collapse Icon */}
          <button
            type="button"
            className="p-1 hover:bg-gray-100 rounded transition-colors"
            aria-label={isExpanded ? 'Collapse' : 'Expand'}
          >
            <svg
              className={cn(
                'w-5 h-5 text-gray-600 transition-transform duration-300',
                isExpanded && 'rotate-180'
              )}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </button>
        </div>

        {/* Progress Bar - Always visible */}
        {hasSchedule && (
          <div className="mt-3 space-y-2">
            <ProgressBar value={percentage} animated showLabel={false} />
            <p className="text-xs text-gray-600">
              {completedUnits} / {totalUnits} units
            </p>
          </div>
        )}
      </CardHeader>

      {/* Expandable Content */}
      {isExpanded && (
        <CardContent className="pt-0">
          <div className="space-y-3">
            {!hasSchedule ? (
              <p className="text-sm text-gray-500">No units scheduled today.</p>
            ) : (
              <div className="space-y-2">
                {subjectUnits.map((u) => {
                  const isCompleted = completedIds.has(u.unitId);
                  const isSubmitting =
                    (markCompleteMutation.isPending || undoProgressMutation.isPending);
                  const completionStatus = unitCompletionStatuses[u.unitId];
                  const canComplete = !completionStatus || completionStatus.canComplete;

                  return (
                    <label
                      key={u.unitId}
                      onClick={(e) => e.stopPropagation()}
                      className={`
                        flex items-start gap-3 p-3 rounded-lg border transition-all
                        ${
                          isCompleted
                            ? 'bg-green-50 border-green-200'
                            : 'bg-white border-gray-200 hover:bg-gray-50'
                        }
                        ${isSubmitting || (!isCompleted && !canComplete) ? 'opacity-60' : 'cursor-pointer'}
                      `}
                    >
                      <input
                        type="checkbox"
                        checked={isCompleted}
                        onChange={(e) => toggleUnit(u.unitId, e.target.checked)}
                        disabled={isSubmitting || (!isCompleted && !canComplete)}
                        className="mt-1 h-5 w-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                        title={!isCompleted && !canComplete && completionStatus?.reason ? completionStatus.reason : undefined}
                      />
                      <div className="flex-1 min-w-0">
                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            router.push(`/plan/${planId}?unitId=${u.unitId}`);
                          }}
                          className={`text-sm font-medium text-left w-full py-1 px-2 -ml-2 rounded hover:bg-blue-50 transition-colors ${
                            isCompleted
                              ? 'text-green-700'
                              : 'text-gray-900 hover:text-blue-600 hover:underline'
                          }`}
                        >
                          {u.title}
                        </button>
                        {u.estimatedHours && (
                          <p className="text-xs text-gray-500 mt-1">
                            Est. {u.estimatedHours} hour{u.estimatedHours > 1 ? 's' : ''}
                          </p>
                        )}

                        {/* Show completion requirements */}
                        {!isCompleted && completionStatus && (
                          <div className="flex items-center gap-2 mt-1 text-xs">
                            {completionStatus.cardsStatus.total > 0 && (
                              <span className={`flex items-center gap-1 ${
                                completionStatus.cardsStatus.passed >= completionStatus.cardsStatus.total
                                  ? 'text-green-600'
                                  : 'text-purple-600'
                              }`}>
                                <Lightbulb className="w-3 h-3" />
                                {completionStatus.cardsStatus.passed}/{completionStatus.cardsStatus.total} cards
                              </span>
                            )}
                            {completionStatus.resourcesStatus.total > 0 && (
                              <span className={`flex items-center gap-1 ${
                                completionStatus.resourcesStatus.completed >= completionStatus.resourcesStatus.total
                                  ? 'text-green-600'
                                  : 'text-gray-500'
                              }`}>
                                {completionStatus.resourcesStatus.completed}/{completionStatus.resourcesStatus.total} resources
                              </span>
                            )}
                          </div>
                        )}

                        {/* Completion requirement warning */}
                        {!isCompleted && !canComplete && completionStatus?.reason && (
                          <div className="mt-2 flex items-start gap-1.5 p-2 bg-amber-50 border border-amber-200 rounded">
                            <AlertCircle className="w-3 h-3 text-amber-600 flex-shrink-0 mt-0.5" />
                            <p className="text-xs text-amber-800">{completionStatus.reason}</p>
                          </div>
                        )}

                      </div>
                      {isSubmitting && (
                        <div className="flex-shrink-0">
                          <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                        </div>
                      )}
                      {isCompleted && !isSubmitting && (
                        <div className="flex-shrink-0 text-green-600">✓</div>
                      )}
                    </label>
                  );
                })}
              </div>
            )}

            {/* Curriculum Alignment Panel */}
            {albertaDocs && (
              <div className="pt-2">
                <CurriculumPanel
                  subject={subject}
                  docs={albertaDocs}
                  {...(totalOutcomes !== undefined && { totalOutcomes })}
                />
              </div>
            )}
          </div>
        </CardContent>
      )}
      </Card>
    </>
  );
}
