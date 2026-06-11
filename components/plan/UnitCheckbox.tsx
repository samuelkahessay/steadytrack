'use client';

import { useState, useMemo, useEffect } from 'react';
import { CheckCircle2, Circle, Clock, FileText, Lightbulb, AlertCircle, ChevronDown, ChevronRight } from 'lucide-react';
import { useRouter } from 'next/navigation';
import ResourceAccordion from './ResourceAccordion';
import CardAccordion from './CardAccordion';
import QuickActionsMenu from './QuickActionsMenu';
import MicrocardModal from '@/components/microcards/MicrocardModal';
import { useMicrocards } from '@/lib/hooks/useMicrocards';
import { CurriculumResource } from '@/lib/types';
import { getSubjectColors } from '@/lib/utils/curriculum';
import { checkUnitCompletionRequirements, UnitCompletionStatus } from '@/lib/utils/unit-completion';
import * as quickCheckStorage from '@/lib/storage/quick-checks';

interface UnitCheckboxProps {
  unitId: string;
  subject: string;
  title: string;
  estimatedHours?: number;
  resources?: CurriculumResource[];
  outcomes?: Array<{
    code: string;
    description?: string;
    title?: string;
    strand?: string;
  }>;
  isCompleted: boolean;
  isSubmitting: boolean;
  onToggle: (unitId: string, subject: string) => void;
  onSetCompletion?: (unitId: string, subject: string, completed: boolean) => void;
  completedResourceUrls: Set<string>;
  onResourceToggle: (unitId: string, resourceUrl: string, completed: boolean) => void;
  planId?: string;
  isHighlighted?: boolean;
}

export default function UnitCheckbox({
  unitId,
  subject,
  title,
  estimatedHours,
  resources,
  outcomes,
  isCompleted,
  isSubmitting,
  onToggle,
  onSetCompletion,
  completedResourceUrls,
  onResourceToggle,
  planId,
  isHighlighted = false,
}: UnitCheckboxProps) {
  const router = useRouter();
  const [showMicrocards, setShowMicrocards] = useState(false);
  const [initialCardIndex, setInitialCardIndex] = useState(0);
  const [completionStatus, setCompletionStatus] = useState<UnitCompletionStatus | null>(null);
  const [checkingStatus, setCheckingStatus] = useState(false);
  const [isResourcesExpanded, setIsResourcesExpanded] = useState(false);
  const [isCardsExpanded, setIsCardsExpanded] = useState(false);
  const [passedCardIds, setPassedCardIds] = useState<Set<string>>(new Set());

  // Memoize outcomeCodes for microcard fetching
  const outcomeCodes = useMemo(() => outcomes?.map((o) => o.code) || [], [outcomes]);
  const shouldFetchMicrocards = outcomeCodes.length > 0;
  const { microcards, loading } = useMicrocards(
    shouldFetchMicrocards ? subject : null,
    shouldFetchMicrocards ? outcomeCodes : []
  );

  // Calculate partial completion state
  const resourcesForUnit = useMemo(() => resources || [], [resources]);
  const completedResourceCount = resourcesForUnit.filter((r) =>
    completedResourceUrls.has(r.url)
  ).length;
  const totalResourceCount = resourcesForUnit.length;

  // Check if unit has any partial progress (resources OR cards)
  const hasPartialResourceProgress = totalResourceCount > 0 && completedResourceCount > 0 && completedResourceCount < totalResourceCount;
  const totalCardCount = microcards.length;
  const passedCardCount = passedCardIds.size;
  const hasPartialCardProgress = totalCardCount > 0 && passedCardCount > 0 && passedCardCount < totalCardCount;
  const hasAnyProgress = (completedResourceCount > 0) || (passedCardCount > 0);

  // Partial state rules:
  // - Any partial progress in resources or cards
  // - OR progress in one dimension while the other is not fully complete
  // - Edge case: zero resources and all cards completed should still show partial if unit isn't marked complete
  const isPartiallyCompleted = !isCompleted && hasAnyProgress && (
    hasPartialResourceProgress ||
    hasPartialCardProgress ||
    (completedResourceCount > 0 && passedCardCount < totalCardCount) ||
    (passedCardCount > 0 && completedResourceCount < totalResourceCount) ||
    (totalResourceCount === 0 && totalCardCount > 0 && passedCardCount === totalCardCount)
  );

  const colors = getSubjectColors(subject);

  // Auto-sync completion for degenerate units (only cards OR only resources):
  // - If there are no resources, completion mirrors whether all cards are passed
  // - If there are no cards, completion mirrors whether all resources are completed
  // This will auto-complete and auto-uncomplete to keep state consistent.
  useEffect(() => {
    if (loading) return;
    // Only apply when exactly one dimension exists
    const onlyCards = totalResourceCount === 0 && totalCardCount > 0;
    const onlyResources = totalCardCount === 0 && totalResourceCount > 0;
    if (!onlyCards && !onlyResources) return;

    const desiredCompleted = (onlyCards && passedCardCount === totalCardCount) ||
      (onlyResources && completedResourceCount === totalResourceCount);

    if (desiredCompleted !== isCompleted) {
      if (onSetCompletion) {
        onSetCompletion(unitId, subject, desiredCompleted);
      } else {
        onToggle(unitId, subject);
      }
    }
  }, [loading, totalResourceCount, totalCardCount, passedCardCount, completedResourceCount, isCompleted, onToggle, onSetCompletion, unitId, subject]);

  // Navigate to study mode when title is clicked (authenticated) or toggle resources (guest)
  const handleTitleClick = () => {
    if (planId && outcomes && outcomes.length > 0) {
      // Navigate to study mode with the first outcome of this unit (authenticated users)
      router.push(`/plan/${planId}/study?unitId=${unitId}`);
    } else if (resources && resources.length > 0) {
      // Toggle resource expansion (guest mode or no outcomes)
      setIsResourcesExpanded(!isResourcesExpanded);
    }
  };

  // Fetch passed card IDs from localStorage
  useEffect(() => {
    const fetchPassedCards = () => {
      // Skip if no microcards
      if (microcards.length === 0) {
        setPassedCardIds(new Set());
        return;
      }

      try {
        const microcardIds = microcards.map(m => m.id);

        // Get latest quiz result for each card from localStorage
        const allResults = quickCheckStorage.getAllResults();

        // Filter to only this unit's cards and sort by date descending
        const sortedResults = allResults
          .filter(r => r.microcard_id && microcardIds.includes(r.microcard_id))
          .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

        // Count unique cards with passing results (latest attempt)
        const passed = new Set<string>();
        const seen = new Set<string>();

        for (const result of sortedResults) {
          const cardId = result.microcard_id;
          if (!cardId || seen.has(cardId)) continue; // Skip if no ID or already seen
          seen.add(cardId);

          if (result.correct) {
            passed.add(cardId);
          }
        }

        setPassedCardIds(passed);
      } catch (error) {
        console.error('Failed to fetch passed cards:', error);
        setPassedCardIds(new Set());
      }
    };

    fetchPassedCards();
  }, [microcards]);

  // Check completion requirements whenever resources or outcomes change
  // Skip for guest users (when planId is not provided)
  useEffect(() => {
    const checkRequirements = async () => {
      // Skip completion checking for guest users
      if (!planId) {
        setCompletionStatus(null);
        return;
      }

      if (isCompleted) {
        // Already complete, no need to check
        setCompletionStatus(null);
        return;
      }

      setCheckingStatus(true);
      try {
        const status = await checkUnitCompletionRequirements({
          unitId,
          subject,
          outcomeCodes,
          resourceUrls: resourcesForUnit.map(r => r.url),
          completedResourceUrls
        });
        setCompletionStatus(status);
      } catch (error) {
        console.error('Failed to check completion requirements:', error);
        setCompletionStatus(null);
      } finally {
        setCheckingStatus(false);
      }
    };

    checkRequirements();
  }, [unitId, subject, outcomeCodes, resourcesForUnit, completedResourceUrls, isCompleted, planId]);

  // Handle unit toggle with verification
  const handleUnitToggle = () => {
    if (isCompleted) {
      // Allow unchecking without verification
      if (onSetCompletion) {
        onSetCompletion(unitId, subject, false);
      } else {
        onToggle(unitId, subject);
      }
      return;
    }

    // Check if requirements are met
    if (completionStatus && !completionStatus.canComplete) {
      // Show a toast or alert about requirements
      // For now, we'll just prevent the toggle
      return;
    }

    if (onSetCompletion) {
      onSetCompletion(unitId, subject, true);
    } else {
      onToggle(unitId, subject);
    }
  };

  return (
    <div
      className={`group border-l-4 ${colors.border} pl-3 pr-3 py-4 rounded-r-xl ${colors.hover} transition-all ${
        isHighlighted ? 'ring-2 ring-blue-400 ring-offset-2 animate-pulse bg-blue-50' : ''
      }`}
      data-unit-id={unitId}
    >
      <div className="flex items-start gap-3">
        {/* Checkbox - Mobile-optimized touch target */}
        <button
          onClick={handleUnitToggle}
          disabled={isSubmitting || checkingStatus || (!isCompleted && !!completionStatus && !completionStatus.canComplete)}
          className={`flex-shrink-0 -mt-1 -ml-1 p-2 transition-all ${
            isSubmitting || checkingStatus
              ? 'opacity-50 cursor-not-allowed'
              : !isCompleted && completionStatus && !completionStatus.canComplete
                ? 'cursor-not-allowed opacity-60'
                : 'hover:scale-110 active:scale-95 cursor-pointer'
          }`}
          aria-label={isCompleted ? 'Mark as incomplete' : 'Mark as complete'}
          title={!isCompleted && completionStatus && !completionStatus.canComplete && completionStatus.reason ? completionStatus.reason : undefined}
        >
          {isCompleted ? (
            <CheckCircle2 className="w-6 h-6 text-green-500" />
          ) : isPartiallyCompleted ? (
            <div className="relative w-6 h-6">
              <Circle className="w-6 h-6 text-blue-500" />
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-3 h-0.5 bg-blue-500 rounded-full" />
              </div>
            </div>
          ) : (
            <Circle className="w-6 h-6 text-gray-300" />
          )}
        </button>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1">
              <button
                onClick={handleTitleClick}
                disabled={!planId && (!resources || resources.length === 0)}
                className={`w-full text-left text-sm sm:text-base font-medium leading-snug transition-colors py-2 -my-2 px-1 -mx-1 rounded-md ${
                  isCompleted
                    ? 'text-gray-400 line-through opacity-60'
                    : (planId && outcomes && outcomes.length > 0) || (resources && resources.length > 0)
                      ? 'text-gray-900 hover:text-blue-600 hover:bg-blue-50 active:bg-blue-100 cursor-pointer'
                      : 'text-gray-900'
                }`}
              >
                <span className="flex items-center gap-2">
                  {!planId && resources && resources.length > 0 && (
                    isResourcesExpanded ?
                      <ChevronDown className="w-4 h-4 flex-shrink-0 text-gray-500" /> :
                      <ChevronRight className="w-4 h-4 flex-shrink-0 text-gray-500" />
                  )}
                  <span className="flex-1">{title}</span>
                </span>
              </button>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                {estimatedHours && (
                  <div className="flex items-center gap-1 text-xs text-gray-500">
                    <Clock className="w-3 h-3" />
                    <span>{estimatedHours}h</span>
                  </div>
                )}
                {totalResourceCount > 0 && (
                  <div className="flex items-center gap-1 text-xs text-gray-500">
                    <FileText className="w-3 h-3" />
                    <span>{completedResourceCount}/{totalResourceCount} resources</span>
                  </div>
                )}
                {(microcards.length > 0 || (completionStatus && completionStatus.cardsStatus.total > 0)) && (
                  <div className={`flex items-center gap-1 text-xs ${
                    (microcards.length > 0
                      ? passedCardIds.size >= microcards.length && microcards.length > 0
                      : (completionStatus?.cardsStatus.passed ?? 0) >= (completionStatus?.cardsStatus.total ?? 0))
                      ? 'text-green-600'
                      : 'text-purple-600'
                  }`}>
                    <Lightbulb className="w-3 h-3" />
                    <span>
                      {microcards.length > 0
                        ? `${passedCardIds.size}/${microcards.length} cards`
                        : `${completionStatus?.cardsStatus.passed ?? 0}/${completionStatus?.cardsStatus.total ?? 0} cards`}
                    </span>
                  </div>
                )}
              </div>
              {/* Completion requirement message */}
              {!isCompleted && completionStatus && !completionStatus.canComplete && completionStatus.reason && (
                <div className="mt-2 flex items-start gap-2 p-2 bg-amber-50 border border-amber-200 rounded-lg">
                  <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-amber-800">{completionStatus.reason}</p>
                </div>
              )}
            </div>

            {/* Quick Actions */}
            <div className="flex items-center gap-1">
              {/* Quick Help Button - Only when microcards exist */}
              {!loading && microcards.length > 0 && (
                <button
                  onClick={() => {
                    if (microcards.length > 0) setShowMicrocards(true);
                  }}
                  className="p-2 -m-1 rounded-lg hover:bg-purple-100 active:bg-purple-200 transition-colors group/help"
                  title="Quick Help"
                  aria-label="Quick Help - Concept cards & tips"
                >
                  <Lightbulb className="w-5 h-5 text-purple-600 group-hover/help:text-purple-700" />
                </button>
              )}
              {/* Alberta Curriculum dropdown - visible on mobile, hover on desktop */}
              <div className="sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                <QuickActionsMenu
                  subject={subject}
                  outcomes={outcomes}
                />
              </div>
            </div>
          </div>

          {/* Learning Cards - Show card progress */}
          {microcards && microcards.length > 0 && !loading && (
            <div className="mt-2">
              <CardAccordion
                microcards={microcards}
                passedCardIds={passedCardIds}
                onCardClick={(clicked) => {
                  const idx = microcards.findIndex((m) => m.id === clicked.id);
                  setInitialCardIndex(idx >= 0 ? idx : 0);
                  setShowMicrocards(true);
                }}
                isOpen={isCardsExpanded}
                onToggle={() => setIsCardsExpanded(!isCardsExpanded)}
              />
            </div>
          )}

          {/* Resources - Controlled expansion state */}
          {resources && resources.length > 0 && (
            <div className="mt-2">
              <ResourceAccordion
                resources={resources}
                completedResourceUrls={completedResourceUrls}
                onResourceToggle={(resourceUrl) => {
                  const isCurrentlyCompleted = completedResourceUrls.has(resourceUrl);
                  onResourceToggle(unitId, resourceUrl, !isCurrentlyCompleted);
                }}
                isOpen={isResourcesExpanded}
                onToggle={() => setIsResourcesExpanded(!isResourcesExpanded)}
              />
            </div>
          )}
        </div>
      </div>

      {/* Microcards Loading State */}
      {showMicrocards && loading && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-sm mx-4 text-center">
            <div className="flex flex-col items-center gap-3">
              <div className="w-12 h-12 border-4 border-purple-600 border-t-transparent rounded-full animate-spin" />
              <p className="text-gray-700">Loading concept cards...</p>
            </div>
          </div>
        </div>
      )}

      {/* Microcards Modal */}
      {showMicrocards && !loading && microcards.length > 0 && (
        <MicrocardModal
          isOpen={showMicrocards}
          onClose={() => setShowMicrocards(false)}
          microcards={microcards}
          initialIndex={initialCardIndex}
          onAnswered={(microcardId, isCorrect) => {
            setPassedCardIds((prev) => {
              const next = new Set(prev);
              if (isCorrect) {
                next.add(microcardId);
              } else {
                next.delete(microcardId);
              }
              return next;
            });
          }}
          {...(planId ? { planId } : {})}
        />
      )}

      {/* Empty State removed: icon is hidden when no microcards exist */}
    </div>
  );
}
