'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, RefreshCw, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { getAllSubjects, getCurriculumData } from '@/data/curriculum';
import { useSettingsPlanQuery } from '@/lib/hooks/queries/useSettingsQuery';
import { useUpdatePlanMutation } from '@/lib/hooks/queries/mutations/useSettingsMutations';

const MAX_SUBJECTS = 12;
const MIN_SUBJECTS = 1;

export function SettingsSubjectsCard() {
  const router = useRouter();

  // Fetch plan and profile with React Query (localStorage mode - no userId needed)
  const { data, isLoading } = useSettingsPlanQuery('');
  const plan = data?.plan ?? null;
  const grade = data?.grade ?? null;

  // Mutation for updating plan (localStorage mode - no userId needed)
  const updatePlan = useUpdatePlanMutation('');

  const [showEditDialog, setShowEditDialog] = useState(false);
  const [selectedSubjects, setSelectedSubjects] = useState<string[]>([]);
  const [durationWeeks, setDurationWeeks] = useState<number>(1);
  const [includesWeekends, setIncludesWeekends] = useState<boolean>(false);
  const [preserveProgress, setPreserveProgress] = useState<boolean>(true);

  // Group subjects by grade level (all subjects available regardless of user's grade)
  const subjectsByGrade = useMemo(() => {
    const allSubjects = getAllSubjects();
    const grade11 = allSubjects.filter((s) => getCurriculumData(s)?.grade === 11);
    const grade12 = allSubjects.filter((s) => getCurriculumData(s)?.grade === 12);
    return { grade11, grade12 };
  }, []);

  const toggleSubject = (subject: string) => {
    if (selectedSubjects.includes(subject)) {
      if (selectedSubjects.length > MIN_SUBJECTS) {
        setSelectedSubjects(selectedSubjects.filter((s) => s !== subject));
      }
    } else {
      if (selectedSubjects.length < MAX_SUBJECTS) {
        setSelectedSubjects([...selectedSubjects, subject]);
      }
    }
  };

  const handleSaveChanges = () => {
    if (!grade) return;

    updatePlan.mutate(
      {
        grade,
        subjects: selectedSubjects,
        displayName: null,
        durationWeeks,
        includesWeekends,
        reset: !preserveProgress, // Reset only if user unchecks preserve
      },
      {
        onSuccess: () => {
          setShowEditDialog(false);
          router.refresh();
          router.push('/dashboard');
        },
        onError: (error) => {
          console.error('Failed to update plan:', error);
        },
      }
    );
  };

  const handleOpenDialog = () => {
    if (plan) {
      setSelectedSubjects(plan.subjects || []);
      setDurationWeeks(plan.duration_weeks || 1);
      setIncludesWeekends(plan.includes_weekends || false);
    }
    setPreserveProgress(true); // Default to preserving progress
    setShowEditDialog(true);
  };

  if (isLoading) {
    return (
      <Card className="p-6 mb-6">
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
        </div>
      </Card>
    );
  }

  if (!plan) {
    return null;
  }

  const hasChanges =
    JSON.stringify(selectedSubjects.sort()) !== JSON.stringify(plan.subjects.sort()) ||
    durationWeeks !== plan.duration_weeks ||
    includesWeekends !== plan.includes_weekends ||
    !preserveProgress; // Allow save if user wants to reset progress

  return (
    <>
      <Card className="p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">Study Plan</h2>
          <Button
            size="sm"
            variant="ghost"
            onClick={handleOpenDialog}
            className="text-blue-600 hover:text-blue-700"
          >
            <RefreshCw className="h-4 w-4 mr-1" />
            Edit Subjects
          </Button>
        </div>

        <div className="space-y-4">
          {/* Current Subjects */}
          <div className="py-3 border-b border-gray-200">
            <p className="text-sm font-medium text-gray-700 mb-2">Subjects</p>
            <div className="flex flex-wrap gap-2">
              {plan.subjects.map((subject) => (
                <span
                  key={subject}
                  className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-blue-100 text-blue-800"
                >
                  {subject}
                </span>
              ))}
            </div>
          </div>

          {/* Duration */}
          <div className="py-3 border-b border-gray-200">
            <p className="text-sm font-medium text-gray-700">Duration</p>
            <p className="text-sm text-gray-600 mt-1">
              {plan.duration_weeks} {plan.duration_weeks === 1 ? 'week' : 'weeks'}
              {plan.includes_weekends && ' (includes weekends)'}
            </p>
          </div>

          {/* Total Units */}
          <div className="py-3">
            <p className="text-sm font-medium text-gray-700">Total Units</p>
            <p className="text-sm text-gray-600 mt-1">{plan.total_units} units</p>
          </div>
        </div>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Study Plan</DialogTitle>
            <DialogDescription>
              Update your subjects and plan settings. This will regenerate your study plan.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 my-4">
            {/* Warning */}
            {!preserveProgress && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex gap-3">
                <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-amber-800">
                  <p className="font-semibold mb-1">Your progress will be reset</p>
                  <p>This will clear all completed units and resources, and reset your streak.</p>
                </div>
              </div>
            )}

            {/* Subject Selection */}
            <div>
              <label className="text-sm font-medium text-gray-700 mb-3 block">
                Select Subjects ({selectedSubjects.length}/{MAX_SUBJECTS})
              </label>

              {/* Grade 11 (20-level) Subjects */}
              <div className="mb-4">
                <h4 className="text-xs font-medium text-gray-600 mb-2 flex items-center gap-2">
                  Grade 11 (20-level)
                  {grade === 11 && (
                    <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">Your grade</span>
                  )}
                </h4>
                <div className="grid grid-cols-2 gap-3">
                  {subjectsByGrade.grade11.map((subject) => {
                    const isSelected = selectedSubjects.includes(subject);
                    const isDisabled = !isSelected && selectedSubjects.length >= MAX_SUBJECTS;

                    return (
                      <button
                        key={subject}
                        onClick={() => toggleSubject(subject)}
                        disabled={isDisabled}
                        className={`
                          p-4 rounded-lg border-2 transition-all text-left
                          ${isSelected
                            ? 'border-blue-500 bg-blue-50'
                            : isDisabled
                            ? 'border-gray-200 bg-gray-50 cursor-not-allowed opacity-50'
                            : 'border-gray-200 hover:border-gray-300'
                          }
                        `}
                      >
                        <div className="flex items-center justify-between">
                          <span className={`text-sm font-medium ${isSelected ? 'text-blue-700' : 'text-gray-900'}`}>
                            {subject}
                          </span>
                          {isSelected && (
                            <div className="w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center">
                              <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                              </svg>
                            </div>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Grade 12 (30-level) Subjects */}
              <div>
                <h4 className="text-xs font-medium text-gray-600 mb-2 flex items-center gap-2">
                  Grade 12 (30-level)
                  {grade === 12 && (
                    <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">Your grade</span>
                  )}
                </h4>
                <div className="grid grid-cols-2 gap-3">
                  {subjectsByGrade.grade12.map((subject) => {
                    const isSelected = selectedSubjects.includes(subject);
                    const isDisabled = !isSelected && selectedSubjects.length >= MAX_SUBJECTS;

                    return (
                      <button
                        key={subject}
                        onClick={() => toggleSubject(subject)}
                        disabled={isDisabled}
                        className={`
                          p-4 rounded-lg border-2 transition-all text-left
                          ${isSelected
                            ? 'border-blue-500 bg-blue-50'
                            : isDisabled
                            ? 'border-gray-200 bg-gray-50 cursor-not-allowed opacity-50'
                            : 'border-gray-200 hover:border-gray-300'
                          }
                        `}
                      >
                        <div className="flex items-center justify-between">
                          <span className={`text-sm font-medium ${isSelected ? 'text-blue-700' : 'text-gray-900'}`}>
                            {subject}
                          </span>
                          {isSelected && (
                            <div className="w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center">
                              <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                              </svg>
                            </div>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <p className="text-xs text-gray-500 mt-3">
                Select {MIN_SUBJECTS}-{MAX_SUBJECTS} subjects from any grade level
              </p>
            </div>

            {/* Duration */}
            <div>
              <label className="text-sm font-medium text-gray-700 mb-3 block">
                Plan Duration
              </label>
              <div className="grid grid-cols-4 gap-2">
                {[1, 2, 4, 8, 12].map((weeks) => (
                  <button
                    key={weeks}
                    onClick={() => setDurationWeeks(weeks)}
                    className={`
                      px-4 py-3 rounded-lg border-2 text-sm font-medium transition-all
                      ${durationWeeks === weeks
                        ? 'border-blue-500 bg-blue-50 text-blue-700'
                        : 'border-gray-200 hover:border-gray-300 text-gray-900'
                      }
                    `}
                  >
                    {weeks}w
                  </button>
                ))}
              </div>
            </div>

            {/* Preserve Progress */}
            <div>
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={preserveProgress}
                  onChange={(e) => setPreserveProgress(e.target.checked)}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <span className="text-sm font-medium text-gray-700">
                  Preserve my completed units and streak
                </span>
              </label>
              <p className="text-xs text-gray-500 mt-1.5 ml-7">
                Keep your progress when regenerating the plan. Uncheck to start fresh.
              </p>
            </div>

            {/* Weekends */}
            <div>
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includesWeekends}
                  onChange={(e) => setIncludesWeekends(e.target.checked)}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <span className="text-sm font-medium text-gray-700">
                  Include weekends in study plan
                </span>
              </label>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowEditDialog(false)}
              disabled={updatePlan.isPending}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveChanges}
              disabled={
                updatePlan.isPending ||
                !hasChanges ||
                selectedSubjects.length < MIN_SUBJECTS ||
                selectedSubjects.length > MAX_SUBJECTS
              }
            >
              {updatePlan.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Saving...
                </>
              ) : preserveProgress ? (
                'Save & Regenerate Plan'
              ) : (
                'Reset & Regenerate Plan'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
