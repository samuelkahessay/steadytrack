'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { useToast } from '@/components/ui/toast';
import { ProgressUpdateResponse } from '@/lib/types';
import { formatMilestoneToast, formatStreakToast } from '@/lib/copy';
import * as progressStorage from '@/lib/storage/progress';
import * as streakStorage from '@/lib/storage/streak';
import * as planStorage from '@/lib/storage/plan';
import { WeeklySummaryStats, StudyStreak } from '@/types/database';
import { LocalStreak } from '@/types/storage';

/**
 * Convert LocalStreak to StudyStreak for compatibility
 * Adds dummy id and user_id fields since we're in local-first mode
 */
function toStudyStreak(localStreak: LocalStreak): StudyStreak {
  return {
    id: 'local-streak',
    user_id: 'local-user',
    current_streak: localStreak.current_streak,
    longest_streak: localStreak.longest_streak,
    last_study_date: localStreak.last_study_date,
    total_study_days: localStreak.total_study_days,
    updated_at: localStreak.updated_at,
  };
}

export interface UnitItem {
  subject: string;
  unitId: string;
  title: string;
  estimatedHours?: number;
}

export interface ProgressUpdatePayload {
  type: 'completed' | 'undone';
  unitId: string;
  subject: string;
  response?: ProgressUpdateResponse;
}

interface UnitChecklistClientProps {
  planId: string;
  units: UnitItem[];
  initialCompletedIds: string[];
  onProgressUpdate: (payload: ProgressUpdatePayload) => void;
}

export default function UnitChecklistClient({
  planId,
  units,
  initialCompletedIds,
  onProgressUpdate,
}: UnitChecklistClientProps) {
  const { showToast } = useToast();

  const [completedUnits, setCompletedUnits] = useState<Set<string>>(
    new Set(initialCompletedIds)
  );
  const [submittingUnits, setSubmittingUnits] = useState<Set<string>>(new Set());

  // Micro-batching queue: coalesce rapid toggles and flush together
  const pendingMap = useRef<
    Map<string, { type: 'completed' | 'undone'; subject: string }>
  >(new Map());
  const flushTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flushPendingOps = useCallback(
    async (_keepalive = false) => {
      const ops = Array.from(pendingMap.current.entries()).map(
        ([unitId, val]) => ({ unitId, ...val })
      );
      pendingMap.current.clear();

      if (ops.length === 0) return;

      try {
        // Get plan for timezone info
        const plan = planStorage.getPlan();
        const timezone = plan?.locked_timezone || 'America/Edmonton';

        const toClear: string[] = [];

        // Process each operation
        let streakIncreased = false;
        let newStreak = 0;
        let milestone: number | undefined;
        let updatedStreakData = streakStorage.getStreak();

        for (const op of ops) {
          try {
            if (op.type === 'completed') {
              // Mark unit complete in localStorage
              const result = progressStorage.markUnitComplete({
                plan_id: planId,
                subject: op.subject,
                unit_id: op.unitId,
              });

              if (!result.success) {
                console.error('Failed to mark unit complete:', result.error);
                throw new Error('Failed to save progress');
              }

              // Increment streak (only once per batch)
              if (!streakIncreased) {
                const streakResult = streakStorage.incrementStreak(timezone);
                if (streakResult.success) {
                  streakIncreased = streakResult.data.increased;
                  updatedStreakData = streakResult.data.streak;
                  newStreak = updatedStreakData.current_streak;

                  // Check for milestone
                  const milestoneValue = streakStorage.checkMilestone(updatedStreakData);
                  if (milestoneValue) {
                    milestone = milestoneValue;
                  }
                }
              }
            } else {
              // Undo unit progress
              progressStorage.deleteUnitProgress(planId, op.unitId);
            }

            toClear.push(op.unitId);

            // Notify parent of the update
            const weeklySummary: WeeklySummaryStats = {
              activityDates: streakStorage.getWeeklyActivityDates(timezone),
              totalUnits: progressStorage.getCompletedUnitsCount(planId),
            };

            const response: ProgressUpdateResponse = {
              success: true,
              streakIncreased,
              newStreak,
              ...(milestone !== undefined && { milestone }),
              streak: toStudyStreak(updatedStreakData),
              weeklySummary,
            };

            onProgressUpdate({
              type: op.type,
              unitId: op.unitId,
              subject: op.subject,
              response,
            });

            // Show toasts for milestones and streaks
            if (op.type === 'completed') {
              if (milestone) {
                showToast(formatMilestoneToast(milestone), 'success');
              } else if (streakIncreased) {
                showToast(formatStreakToast(newStreak), 'success');
              }
            }
          } catch (err) {
            // If individual operation fails, roll back and show error
            setCompletedUnits((prev) => {
              const next = new Set(prev);
              if (op.type === 'completed') next.delete(op.unitId);
              else next.add(op.unitId);
              return next;
            });
            const msg = err instanceof Error ? err.message : 'Failed to save progress';
            showToast(msg, 'error');
          }
        }

        // Clear submitting flags
        if (toClear.length) {
          setSubmittingUnits((prev) => {
            const next = new Set(prev);
            toClear.forEach((id) => next.delete(id));
            return next;
          });
        }
      } catch (err) {
        // On total failure, roll back all ops and clear submitting flags
        setCompletedUnits((prev) => {
          const next = new Set(prev);
          ops.forEach((op) => {
            if (op.type === 'completed') next.delete(op.unitId);
            else next.add(op.unitId);
          });
          return next;
        });
        setSubmittingUnits((prev) => {
          const next = new Set(prev);
          ops.forEach((op) => next.delete(op.unitId));
          return next;
        });
        const message = err instanceof Error ? err.message : 'Failed to process updates';
        showToast(message, 'error');
      }
    },
    [planId, onProgressUpdate, showToast]
  );

  const scheduleFlush = useCallback(() => {
    if (flushTimer.current) return;
    flushTimer.current = setTimeout(async () => {
      flushTimer.current = null;
      await flushPendingOps(false);
    }, 100);
  }, [flushPendingOps]);

  const flushNow = useCallback(async (keepalive = false) => {
    if (flushTimer.current) {
      clearTimeout(flushTimer.current);
      flushTimer.current = null;
    }
    await flushPendingOps(keepalive);
  }, [flushPendingOps]);

  const handleToggleUnit = useCallback(
    async (unitId: string, subject: string, nextChecked: boolean) => {
      // Optimistic local toggle (instant)
      setCompletedUnits((prev) => {
        const next = new Set(prev);
        if (nextChecked) next.add(unitId);
        else next.delete(unitId);
        return next;
      });

      // Mark as submitting (visual hint), but do not disable interaction
      setSubmittingUnits((prev) => {
        const next = new Set(prev);
        next.add(unitId);
        return next;
      });

      // Coalesce last intent per unit and schedule a micro-batch flush
      pendingMap.current.set(unitId, {
        type: nextChecked ? 'completed' : 'undone',
        subject,
      });
      scheduleFlush();

      // Notify parent immediately for UI consistency across widgets
      onProgressUpdate({
        type: nextChecked ? 'completed' : 'undone',
        unitId,
        subject,
        response: {
          success: true,
          streakIncreased: false,
          newStreak: 0,
          streak: null,
          weeklySummary: null,
        },
      });
    },
    [scheduleFlush, onProgressUpdate]
  );

  // Flush any pending updates when the tab is hidden or page is unloading
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'hidden') {
        flushNow(true);
      }
    };
    const handlePageHide = () => flushNow(true);

    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('pagehide', handlePageHide);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('pagehide', handlePageHide);
    };
  }, [flushNow]);

  // Group units by subject
  const unitsBySubject = units.reduce((acc, unit) => {
    if (!acc[unit.subject]) {
      acc[unit.subject] = [];
    }
    acc[unit.subject].push(unit);
    return acc;
  }, {} as Record<string, UnitItem[]>);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Today&apos;s Units</CardTitle>
        <p className="text-sm text-gray-600 mt-2">
          Check off units as you complete them to track your progress
        </p>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {Object.entries(unitsBySubject).map(([subject, subjectUnits]) => (
            <div key={subject}>
              <h3 className="font-semibold text-gray-900 mb-3">{subject}</h3>
              <div className="space-y-2">
                {subjectUnits.map((unit) => {
                  const isCompleted = completedUnits.has(unit.unitId);
                  const isSubmitting = submittingUnits.has(unit.unitId);

                  return (
                    <label
                      key={unit.unitId}
                      className={`
                        flex items-start gap-3 p-3 rounded-lg border transition-all
                        ${
                          isCompleted
                            ? 'bg-green-50 border-green-200'
                            : 'bg-white border-gray-200 hover:bg-gray-50'
                        }
                        ${isSubmitting ? 'opacity-60' : 'cursor-pointer'}
                      `}
                    >
                      <input
                        type="checkbox"
                        checked={isCompleted}
                        onChange={(event) =>
                          handleToggleUnit(unit.unitId, subject, event.target.checked)
                        }
                        className="mt-1 h-5 w-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500 disabled:opacity-50"
                      />
                      <div className="flex-1 min-w-0">
                        <p
                          className={`text-sm font-medium ${
                            isCompleted
                              ? 'text-green-700 line-through'
                              : 'text-gray-900'
                          }`}
                        >
                          {unit.title}
                        </p>
                        {unit.estimatedHours && (
                          <p className="text-xs text-gray-500 mt-1">
                            Est. {unit.estimatedHours} hour
                            {unit.estimatedHours > 1 ? 's' : ''}
                          </p>
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
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
