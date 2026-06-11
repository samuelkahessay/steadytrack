'use client';

import { useState, useMemo, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast';
import { logger } from '@/lib/logger';
import { getAllSubjects, getCurriculumData } from '@/data/curriculum';
import { generatePlan } from '@/lib/shared/planGenerator';
import { createPlan } from '@/lib/storage/plan';
import { LocalPlanInput } from '@/types/storage';

function SubjectSelectionContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { showToast } = useToast();

  const gradeParam = searchParams.get('grade');
  const [selectedGrade, setSelectedGrade] = useState<number | null>(gradeParam ? parseInt(gradeParam) : null);
  const [selectedSubjects, setSelectedSubjects] = useState<string[]>([]);
  const [durationWeeks, setDurationWeeks] = useState<number>(1);
  const [includesWeekends, setIncludesWeekends] = useState<boolean>(false);
  const [isGenerating, setIsGenerating] = useState(false);

  // Group subjects by grade level (all subjects available regardless of user's grade)
  const subjectsByGrade = useMemo(() => {
    const allSubjects = getAllSubjects();
    const grade11 = allSubjects.filter((s) => getCurriculumData(s)?.grade === 11);
    const grade12 = allSubjects.filter((s) => getCurriculumData(s)?.grade === 12);
    return { grade11, grade12 };
  }, []);

  const toggleSubject = (subject: string) => {
    if (selectedSubjects.includes(subject)) {
      setSelectedSubjects(selectedSubjects.filter((s) => s !== subject));
    } else {
      if (selectedSubjects.length < 12) {
        setSelectedSubjects([...selectedSubjects, subject]);
      } else {
        showToast('You can select up to 12 subjects', 'error');
      }
    }
  };

  const handleGeneratePlan = async () => {
    if (!selectedGrade) {
      showToast('Please select your grade level', 'error');
      return;
    }

    if (selectedSubjects.length < 2 || selectedSubjects.length > 12) {
      showToast('Please select 2-12 subjects', 'error');
      return;
    }

    setIsGenerating(true);

    try {
      // Local-first flow: generate plan client-side using new outcome-based generator
      const studyPlan = generatePlan(
        selectedSubjects,
        durationWeeks,
        includesWeekends
        // startDate defaults to today
      );

      // Calculate dates
      const startDate = new Date();
      const endDate = new Date(startDate);
      endDate.setDate(startDate.getDate() + (durationWeeks * (includesWeekends ? 7 : 5)));

      // Create plan input
      const planInput: LocalPlanInput = {
        subjects: selectedSubjects,
        schedule: studyPlan, // Now using outcome-based structure
        total_units: studyPlan.days.reduce((acc, day) => acc + day.outcomes.length, 0),
        duration_weeks: durationWeeks,
        includes_weekends: includesWeekends,
        start_date: startDate.toISOString().split('T')[0],
        end_date: endDate.toISOString().split('T')[0],
        current_day_index: 0,
        status: 'active',
        locked_timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      };

      // Create plan (progress/streak initialized on demand)
      createPlan(planInput);

      showToast('Your study plan has been created!', 'success');
      router.push('/dashboard');
    } catch (error) {
      logger.error('Failed to generate study plan', error instanceof Error ? error : undefined, {
        selectedSubjects: selectedSubjects.length
      });
      showToast('An error occurred. Please try again.', 'error');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center px-4 py-8">
      <div className="max-w-3xl w-full bg-white rounded-lg shadow-xl p-8">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Create Your Study Plan
          </h1>
          <p className="text-gray-600">
            Select your grade, subjects, and configure your study schedule
          </p>
        </div>

        {/* Grade Selection */}
        <div className="mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            1. Select Your Grade
          </h2>
          <div className="grid grid-cols-2 gap-4 mb-4">
            {[11, 12].map((grade) => (
              <Card
                key={grade}
                className={`p-6 cursor-pointer transition-all min-h-[100px] flex items-center justify-center ${
                  selectedGrade === grade
                    ? 'border-blue-500 border-2 bg-blue-50'
                    : 'hover:border-gray-300 border-2 border-transparent'
                }`}
                onClick={() => setSelectedGrade(grade)}
              >
                <p className="text-2xl font-bold text-center">Grade {grade}</p>
              </Card>
            ))}
          </div>
        </div>

        {/* Subjects Section */}
        <div className="mb-8 border-t pt-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            2. Select Subjects (2-12)
          </h2>

          {/* Grade 11 (20-level) Subjects */}
          <div className="mb-6">
            <h3 className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
              Grade 11 (20-level)
              {selectedGrade === 11 && (
                <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">Your grade</span>
              )}
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {subjectsByGrade.grade11.map((subject) => {
                const isSelected = selectedSubjects.includes(subject);
                const isDisabled = selectedSubjects.length >= 12 && !isSelected;

                return (
                  <Card
                    key={subject}
                    className={`p-6 cursor-pointer transition-all min-h-[80px] flex items-center justify-center ${
                      isSelected
                        ? 'border-blue-500 border-2 bg-blue-50'
                        : isDisabled
                        ? 'opacity-50 cursor-not-allowed border-2 border-transparent'
                        : 'hover:border-gray-300 border-2 border-transparent'
                    }`}
                    onClick={() => !isDisabled && toggleSubject(subject)}
                  >
                    <div className="text-center w-full">
                      <p className="text-base font-semibold">{subject}</p>
                      {isSelected && (
                        <div className="mt-2">
                          <span className="text-blue-500 text-xl">✓</span>
                        </div>
                      )}
                    </div>
                  </Card>
                );
              })}
            </div>
          </div>

          {/* Grade 12 (30-level) Subjects */}
          <div className="mb-4">
            <h3 className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
              Grade 12 (30-level)
              {selectedGrade === 12 && (
                <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">Your grade</span>
              )}
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {subjectsByGrade.grade12.map((subject) => {
                const isSelected = selectedSubjects.includes(subject);
                const isDisabled = selectedSubjects.length >= 12 && !isSelected;

                return (
                  <Card
                    key={subject}
                    className={`p-6 cursor-pointer transition-all min-h-[80px] flex items-center justify-center ${
                      isSelected
                        ? 'border-blue-500 border-2 bg-blue-50'
                        : isDisabled
                        ? 'opacity-50 cursor-not-allowed border-2 border-transparent'
                        : 'hover:border-gray-300 border-2 border-transparent'
                    }`}
                    onClick={() => !isDisabled && toggleSubject(subject)}
                  >
                    <div className="text-center w-full">
                      <p className="text-base font-semibold">{subject}</p>
                      {isSelected && (
                        <div className="mt-2">
                          <span className="text-blue-500 text-xl">✓</span>
                        </div>
                      )}
                    </div>
                  </Card>
                );
              })}
            </div>
          </div>

          <p className="text-sm text-gray-500 text-center">
            {selectedSubjects.length} / 12 subjects selected
          </p>
        </div>

        {/* Duration Section */}
        <div className="mb-8 border-t pt-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            3. Plan Duration
          </h2>
          <p className="text-sm text-gray-600 mb-4">
            How long do you want your study plan to be?
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[1, 2, 3, 4].map((weeks) => (
              <Card
                key={weeks}
                className={`p-4 cursor-pointer transition-all ${
                  durationWeeks === weeks
                    ? 'border-blue-500 border-2 bg-blue-50'
                    : 'hover:border-gray-300 border-2 border-transparent'
                }`}
                onClick={() => setDurationWeeks(weeks)}
              >
                <div className="text-center">
                  <p className="text-lg font-bold">{weeks} Week{weeks > 1 ? 's' : ''}</p>
                  <p className="text-xs text-gray-500 mt-1">
                    {weeks * (includesWeekends ? 7 : 5)} days
                  </p>
                </div>
              </Card>
            ))}
          </div>
          <div className="mt-4">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="number"
                min="1"
                max="12"
                value={durationWeeks}
                onChange={(e) => setDurationWeeks(Math.max(1, Math.min(12, parseInt(e.target.value) || 1)))}
                className="border border-gray-300 rounded px-3 py-2 w-20 text-center"
              />
              <span className="text-sm text-gray-600">Or enter custom weeks (1-12)</span>
            </label>
          </div>
        </div>

        {/* Weekends Section */}
        <div className="mb-8 border-t pt-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            4. Include Weekends?
          </h2>
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={includesWeekends}
              onChange={(e) => setIncludesWeekends(e.target.checked)}
              className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <div>
              <p className="font-medium">Study on weekends too</p>
              <p className="text-sm text-gray-600">
                {includesWeekends
                  ? 'Units will be spread across 7 days per week (including Sat/Sun)'
                  : 'Units will be spread across 5 weekdays only (Mon-Fri)'}
              </p>
            </div>
          </label>
        </div>

        {/* Summary */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <p className="text-sm font-medium text-blue-900">
            📋 Your plan: {selectedSubjects.length} subject{selectedSubjects.length !== 1 ? 's' : ''} over {durationWeeks} week{durationWeeks > 1 ? 's' : ''} ({durationWeeks * (includesWeekends ? 7 : 5)} days)
          </p>
        </div>

        <div className="flex gap-4">
          <Button
            variant="outline"
            onClick={() => router.push('/dashboard')}
            className="flex-1 h-12"
            disabled={isGenerating}
          >
            Cancel
          </Button>
          <Button
            onClick={handleGeneratePlan}
            disabled={!selectedGrade || selectedSubjects.length < 2 || isGenerating}
            className="flex-1 h-12 text-lg"
          >
            {isGenerating ? 'Creating your plan...' : 'Generate My Plan'}
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function SubjectSelectionPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    }>
      <SubjectSelectionContent />
    </Suspense>
  );
}
