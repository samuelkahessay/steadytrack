'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import DashboardClient from '@/components/dashboard/DashboardClient';
import DashboardSkeleton from '@/components/dashboard/DashboardSkeleton';
import { QuotaWarning } from '@/components/storage/QuotaWarning';
import { getCurriculumData } from '@/data/curriculum';
import type { StudyPlan, FlexibleSchedule, UserProgress } from '@/lib/types';
import { formatLocalDate } from '@/lib/date';
import { logger } from '@/lib/logger';
import * as planStorage from '@/lib/storage/plan';
import * as progressStorage from '@/lib/storage/progress';
import * as streakStorage from '@/lib/storage/streak';

/**
 * Dashboard page - local-first, no auth required
 * Reads from localStorage, redirects to /plan/new if no plan exists
 */

function pickTodaysUnits(plan: StudyPlan) {
  const today = formatLocalDate(new Date());
  const schedule = plan.schedule as FlexibleSchedule;

  // Prefer exact date match if dates were assigned during plan creation
  const targetDay = schedule.days.find((d) => d.date === today) ?? schedule.days[0];
  const outcomes = targetDay?.outcomes ?? [];

  // Group outcomes by unit for backward compatibility with DashboardClient
  const unitMap = new Map<string, { subject: string; unitId: string; title: string; estimatedHours?: number }>();

  outcomes.forEach((outcome) => {
    const key = `${outcome.subject}:${outcome.unitId}`;
    if (!unitMap.has(key)) {
      const estimatedHours = getCurriculumData(outcome.subject)?.units.find((x) => x.id === outcome.unitId)?.estimatedHours;
      unitMap.set(key, {
        subject: outcome.subject,
        unitId: outcome.unitId,
        title: outcome.unitTitle,
        ...(estimatedHours !== undefined && { estimatedHours }),
      });
    }
  });

  return Array.from(unitMap.values());
}

export default function DashboardPage() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // Set mounted state to true after client-side hydration
    setMounted(true);

    // Check if plan exists in localStorage
    const plan = planStorage.getPlan();
    if (!plan) {
      logger.info('No plan found in localStorage, redirecting to plan creation');
      router.push('/plan/new');
    }
  }, [router]);

  // Show skeleton during SSR and initial client render
  // This ensures server and client render the same HTML
  if (!mounted) {
    return <DashboardSkeleton />;
  }

  // Read from localStorage (only after client mount)
  const plan = planStorage.getPlan();

  // If no plan, show loading while redirect happens
  if (!plan) {
    return <DashboardSkeleton />;
  }

  // Validate plan structure
  if (!plan.schedule || typeof plan.schedule !== 'object') {
    logger.error('Invalid plan schedule structure', new Error('Invalid schedule'), { planId: plan?.id });
    throw new Error('Study plan has invalid schedule structure');
  }

  // Get streak and progress from localStorage
  const streak = streakStorage.getStreak();
  const allProgress = progressStorage.getProgress(plan.id);

  // Compute today's units from the plan schedule
  const todaysUnits = pickTodaysUnits(plan as StudyPlan);

  const todaysUnitIdSet = new Set(todaysUnits.map((u) => u.unitId));
  const completedUnitIds = allProgress
    .filter((p) => p.completed)
    .map((p) => p.unit_id)
    .filter((id) => todaysUnitIdSet.has(id));

  // Convert LocalUserProgress to UserProgress for DashboardClient
  const initialProgress: UserProgress[] = allProgress.map((p) => ({
    id: p.id,
    user_id: '', // No user ID in local-first
    plan_id: p.plan_id,
    unit_id: p.unit_id,
    subject: p.subject,
    completed: p.completed,
    completed_at: p.started_at, // Map to old field name for compatibility
    created_at: p.created_at,
  }));

  return (
    <>
      <QuotaWarning />
      <DashboardClient
        plan={plan as StudyPlan}
        planId={plan.id}
        units={todaysUnits}
        initialCompletedIds={completedUnitIds}
        initialProgress={initialProgress}
        initialStreak={{
          id: 'local-streak',
          user_id: '', // Required for UserProgress type compatibility
          current_streak: streak.current_streak,
          longest_streak: streak.longest_streak,
          last_study_date: streak.last_study_date,
          total_study_days: streak.total_study_days,
          updated_at: streak.updated_at,
        }}
        initialWeeklySummary={null}
      />
    </>
  );
}
