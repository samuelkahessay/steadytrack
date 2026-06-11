'use client';

import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import QuickActionButton from './QuickActionButton';
import { cta } from '@/lib/copy';
import { StudyPlan, UserProgress } from '@/lib/types';
import { getCurriculumData } from '@/data/curriculum';

interface TodaysFocusProps {
  plan: StudyPlan;
  progress: UserProgress[];
}

export default function TodaysFocus({ plan, progress }: TodaysFocusProps) {
  const completedUnitIds = new Set(progress.map((p) => p.unit_id));

  // Prioritize Math/English, then pick shortest duration
  const prioritySubjects = ['Math 30-1', 'English 30-1'];
  let suggestedUnit = null;
  let suggestedSubject = null;

  // First pass: try priority subjects
  for (const subject of prioritySubjects) {
    if (!plan.subjects.includes(subject)) continue;
    const curriculum = getCurriculumData(subject);
    if (!curriculum) continue;

    const incompleteUnits = curriculum.units.filter(
      (unit) => !completedUnitIds.has(unit.id)
    );

    if (incompleteUnits.length > 0) {
      // Pick shortest duration unit
      const shortestUnit = incompleteUnits.reduce((shortest, unit) =>
        (unit.estimatedHours || 1) < (shortest.estimatedHours || 1) ? unit : shortest
      );
      suggestedUnit = shortestUnit;
      suggestedSubject = subject;
      break;
    }
  }

  // Second pass: try other subjects
  if (!suggestedUnit) {
    for (const subject of plan.subjects) {
      if (prioritySubjects.includes(subject)) continue;
      const curriculum = getCurriculumData(subject);
      if (!curriculum) continue;

      const incompleteUnits = curriculum.units.filter(
        (unit) => !completedUnitIds.has(unit.id)
      );

      if (incompleteUnits.length > 0) {
        // Pick shortest duration unit
        const shortestUnit = incompleteUnits.reduce((shortest, unit) =>
          (unit.estimatedHours || 1) < (shortest.estimatedHours || 1) ? unit : shortest
        );
        suggestedUnit = shortestUnit;
        suggestedSubject = subject;
        break;
      }
    }
  }

  if (!suggestedUnit) {
    return (
      <Card className="bg-gradient-to-br from-green-50 to-emerald-100 border-2 border-green-200 shadow-lg">
        <CardContent className="p-6 md:p-8 text-center">
          <div className="text-5xl mb-3">🎉</div>
          <p className="text-green-700 font-bold text-xl md:text-2xl">
            All caught up!
          </p>
          <p className="text-green-600 text-sm md:text-base mt-2">
            You&apos;ve completed everything on your plan!
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-2 border-blue-200 bg-gradient-to-br from-blue-50 to-indigo-50 shadow-lg">
      <CardHeader className="pb-3">
        <CardTitle className="text-xl md:text-2xl flex items-center gap-2">
          <span className="text-2xl">🎯</span>
          <span>Today</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 md:space-y-5">
        <div className="bg-white/60 rounded-lg p-4 md:p-5">
          <p className="text-xs md:text-sm text-blue-700 font-semibold uppercase tracking-wide mb-1">
            {suggestedSubject}
          </p>
          <h3 className="text-lg md:text-xl font-bold text-gray-900 leading-tight">
            {suggestedUnit.title}
          </h3>
          <div className="flex items-center gap-2 mt-2 text-sm text-gray-600">
            <svg
              className="w-4 h-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <span>
              {suggestedUnit.estimatedHours || 1} hour
              {(suggestedUnit.estimatedHours || 1) > 1 ? 's' : ''}
            </span>
          </div>
        </div>
        <QuickActionButton
          variant="primary"
          className="w-full text-base md:text-lg font-bold py-3 md:py-4 shadow-xl hover:shadow-2xl transition-all"
          href={`/plan/${plan.id}`}
        >
          {cta.startQuickSession}
        </QuickActionButton>
      </CardContent>
    </Card>
  );
}
