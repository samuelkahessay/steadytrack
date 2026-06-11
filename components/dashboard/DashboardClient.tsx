'use client';

import { useState, useMemo } from 'react';
import DashboardHeader from '@/components/dashboard/DashboardHeader';
import StreakHero from '@/components/dashboard/StreakHero';
import SubjectProgressCard from '@/components/dashboard/SubjectProgressCard';
import TodaysFocus from '@/components/dashboard/TodaysFocus';
import YourProgress from '@/components/dashboard/YourProgress';
import CelebrationModal from '@/components/dashboard/CelebrationModal';
import Footer from '@/components/landing/Footer';
import { InfinityButton } from '@/components/InfinityButton';
import type {
  UnitItem,
  ProgressUpdatePayload,
} from '@/components/dashboard/UnitChecklistClient';
import { useToast } from '@/components/ui/toast';
import type {
  StudyPlan,
  StudyStreak,
  UserProgress,
  WeeklySummaryStats,
} from '@/lib/types';
import { getCurriculumData } from '@/data/curriculum';
import { formatStreakToast } from '@/lib/copy';
import { useDashboardQueryLocal } from '@/lib/hooks/queries/useDashboardQueryLocal';

interface DashboardClientProps {
  plan: StudyPlan;
  planId: string;
  units: UnitItem[];
  initialCompletedIds: string[];
  initialProgress: UserProgress[];
  initialStreak: StudyStreak | null;
  initialWeeklySummary: WeeklySummaryStats | null;
}

export default function DashboardClient({
  plan,
  planId,
  units,
  initialCompletedIds: _initialCompletedIds,
  initialProgress,
  initialStreak,
  initialWeeklySummary,
}: DashboardClientProps) {
  const { showToast } = useToast();

  // Celebration modal state
  const [celebrationMilestone, setCelebrationMilestone] = useState<number | null>(null);
  const [showCelebration, setShowCelebration] = useState(false);

  // Fetch all dashboard data with React Query (localStorage version)
  // This replaces:
  // - manual useState for streak, progress, weeklySummary (lines 50-54)
  // - refreshData callback (lines 115-178)
  // - focus/visibility listeners (lines 181-198)
  // - initial weekly summary computation (lines 59-112)
  const { data } = useDashboardQueryLocal(planId);

  // Use server-provided initial data until React Query loads
  const streak = data?.streak ?? initialStreak;
  const progress = data?.progress ?? initialProgress;
  const weeklySummary = data?.weeklySummary ?? initialWeeklySummary;

  // Handle progress updates from SubjectProgressCard
  // SubjectProgressCard already performs the mutation, we just handle the response here
  // for celebrations and toasts
  const handleProgressUpdate = ({ type, response }: ProgressUpdatePayload) => {
    if (type === 'completed' && response) {
      // Show celebration modal if milestone reached
      if (response.milestone) {
        setCelebrationMilestone(response.milestone);
        setShowCelebration(true);
      }
      // Show toast if streak increased (but no milestone)
      else if (response.streakIncreased && response.newStreak) {
        showToast(formatStreakToast(response.newStreak), 'success');
      }
    }
  };

  // Compute curriculum data for each subject
  const subjectCurriculumData = useMemo(() => {
    const data: Record<string, { albertaDocs?: Array<{ title: string; url: string; type?: string }>; totalOutcomes: number }> = {};
    plan.subjects.forEach((subject) => {
      const curriculumData = getCurriculumData(subject);
      if (curriculumData) {
        const totalOutcomes = curriculumData.units.reduce(
          (sum, unit) => sum + (unit.outcomes?.length || 0),
          0
        );
        const entry: { albertaDocs?: Array<{ title: string; url: string; type?: string }>; totalOutcomes: number } = {
          totalOutcomes,
        };
        if (curriculumData.albertaDocs) {
          entry.albertaDocs = curriculumData.albertaDocs;
        }
        data[subject] = entry;
      }
    });
    return data;
  }, [plan.subjects]);

  return (
    <>
      <div className="min-h-screen bg-gray-50">
        <DashboardHeader />

        {/* Main Content with better mobile spacing */}
        <div className="max-w-6xl mx-auto px-4 pb-8">
          {/* Streak Hero - Sticky on mobile */}
          <div className="mb-6">
            <StreakHero streak={streak} planId={planId} />
          </div>

          {/* Quick Learn Mode - Featured Action */}
          <div className="mb-6">
            <div className="bg-gradient-to-r from-indigo-600 via-purple-600 to-violet-600 rounded-lg shadow-lg p-6 text-white">
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="text-center sm:text-left">
                  <h3 className="text-xl font-bold mb-2">Quick Learn Mode</h3>
                  <p className="text-indigo-100 text-sm">
                    TikTok-style quiz practice • Build your streak
                  </p>
                </div>
                <InfinityButton />
              </div>
            </div>
          </div>

          {/* Today's Focus - Hero position */}
          <div className="mb-6">
            <TodaysFocus plan={plan} progress={progress} />
          </div>

          {/* Your Progress - Collapsible */}
          <div className="mb-6">
            <YourProgress
              summary={weeklySummary}
              progress={progress}
              defaultExpanded={false}
            />
          </div>

          {/* Subject Progress Cards Grid */}
          {plan.subjects.length > 0 && (
            <div className="mb-6">
              <h2 className="text-lg md:text-xl font-semibold text-gray-900 mb-4">
                Your Subjects
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6 items-start">
                {plan.subjects.map((subject) => {
                  const currData = subjectCurriculumData[subject];
                  const cardProps: {
                    subject: string;
                    planId: string;
                    progress: UserProgress[];
                    units: UnitItem[];
                    onProgressUpdate: (payload: ProgressUpdatePayload) => void;
                    albertaDocs?: Array<{ title: string; url: string; type?: string }>;
                    totalOutcomes?: number;
                  } = {
                    subject,
                    planId,
                    progress,
                    units,
                    onProgressUpdate: handleProgressUpdate,
                  };
                  if (currData?.albertaDocs) {
                    cardProps.albertaDocs = currData.albertaDocs;
                  }
                  if (currData?.totalOutcomes !== undefined) {
                    cardProps.totalOutcomes = currData.totalOutcomes;
                  }
                  return <SubjectProgressCard key={subject} {...cardProps} />;
                })}
              </div>
            </div>
          )}
        </div>

        <Footer />
      </div>

      {/* Celebration Modal */}
      <CelebrationModal
        isOpen={showCelebration}
        milestone={celebrationMilestone}
        onClose={() => {
          setShowCelebration(false);
          setCelebrationMilestone(null);
        }}
      />
    </>
  );
}
