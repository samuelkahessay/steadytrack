// Centralized, supportive copy helpers for strike context

export type StreakState = {
  currentStreak: number;
  studiedToday: boolean;
  studiedYesterday: boolean;
};

export function buildStreakMessage({ currentStreak, studiedToday, studiedYesterday }: StreakState) {
  if (currentStreak > 0 && studiedToday) {
    return `${currentStreak}-day streak—great consistency.`;
  }
  if (currentStreak > 0 && studiedYesterday) {
    return `Keep your ${currentStreak}-day streak going—one small session today.`;
  }
  return 'Start fresh—one small unit is enough.';
}

export function buildStreakCta({ currentStreak, studiedToday, studiedYesterday }: StreakState) {
  if (currentStreak > 0 && studiedToday) return cta.viewPlan;
  if (currentStreak > 0 && studiedYesterday) return cta.startShortSession;
  return cta.easeBackIn;
}

export function buildStudyPulseMessage(percentage: number, studiedToday: boolean) {
  if (percentage >= 75) return 'Excellent consistency—nice work.';
  if (percentage >= 50) return 'Good progress—aim for small, steady sessions when you can.';
  if (studiedToday) return 'Great job today—every bit counts.';
  return "When you're ready, a short session today helps.";
}

export function formatStreakToast(newStreak: number) {
  return `🔥 ${newStreak}-day streak—nice and steady.`;
}

export function formatMilestoneToast(milestonePercent: number) {
  return `🎉 ${milestonePercent}% complete—nice progress.`;
}

export const cta = {
  startQuickSession: 'Start a quick session',
  startShortSession: 'Start a short session',
  easeBackIn: 'Ease Back In',
  viewPlan: 'View My Plan',
};

