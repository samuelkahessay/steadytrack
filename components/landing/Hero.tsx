'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Compass, Sparkles, CheckCircle } from 'lucide-react';
import { getPlan } from '@/lib/storage/plan';
import { getSession } from '@/lib/storage/infinite';
import { getStreak } from '@/lib/storage/streak';
import { getCurriculumStats } from '@/lib/utils/curriculum';
import { AnimatedCounter, StaggerContainer, ScrollReveal } from '@/components/motion';
import { motion } from 'framer-motion';
import { staggerChildVariants } from '@/components/motion/StaggerContainer';

export default function Hero() {
  const router = useRouter();
  const [hasPlan, setHasPlan] = useState(false);
  const [hasSession, setHasSession] = useState(false);
  const [streakDays, setStreakDays] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  const stats = getCurriculumStats();

  useEffect(() => {
    // Check for existing user data on mount
    const plan = getPlan();
    const session = getSession();
    const streak = getStreak();

    setHasPlan(plan !== null && plan.status === 'active');
    setHasSession(session !== null);
    setStreakDays(streak?.current_streak || 0);
    setIsLoading(false);
  }, []);

  const handlePlanClick = () => {
    if (hasPlan) {
      router.push('/dashboard');
    } else {
      router.push('/plan/new');
    }
  };

  const handleQuickLearnClick = () => {
    if (hasSession) {
      router.push('/learn/infinite');
    } else {
      router.push('/learn/infinite');
    }
  };

  return (
    <section className="relative overflow-hidden bg-gradient-to-br from-blue-50 via-white to-indigo-50 pb-20">
      {/* Crisis Context Ribbon */}
      <div className="bg-amber-100 border-b border-amber-200 py-2 px-4 text-center mb-12">
        <p className="text-sm sm:text-base font-medium text-amber-900">
          🎓 For Alberta students affected by the teacher strike
        </p>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-8">
        {/* Headline */}
        <ScrollReveal direction="down">
          <div className="text-center mb-16">
            <h1 className="font-display text-5xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight text-gray-900 leading-tight mb-4">
              SteadyTrack
            </h1>
            <h2 className="font-display text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-gray-900 leading-tight mb-6 flex items-center justify-center gap-3 flex-wrap">
              <Compass className="w-8 h-8 sm:w-10 sm:h-10 lg:w-12 lg:h-12 text-blue-600 flex-shrink-0" />
              <span>Stay on track <span className="text-blue-600">during the strike.</span></span>
            </h2>

            {/* Welcome Back Message for Returning Users */}
            {!isLoading && (hasPlan || hasSession || streakDays > 0) && (
              <div className="mb-6 inline-block bg-blue-50 border border-blue-200 rounded-lg px-6 py-3">
                <p className="text-lg font-semibold text-blue-900">
                  Welcome back! {streakDays > 0 && `Keep your ${streakDays}-day streak alive 🔥`}
                </p>
              </div>
            )}

            <p className="text-lg sm:text-xl text-gray-600 max-w-2xl mx-auto">
              Built for Alberta students — stay focused and keep learning during the strike.
            </p>
          </div>
        </ScrollReveal>

        {/* Stat Ticker Row */}
        <StaggerContainer staggerDelay={0.15} className="grid grid-cols-2 md:grid-cols-4 gap-6 max-w-3xl mx-auto mb-12">
          <motion.div variants={staggerChildVariants} className="text-center md:border-r md:border-gray-200">
            <AnimatedCounter value={stats.totalOutcomes} label="Learning Outcomes" />
          </motion.div>
          <motion.div variants={staggerChildVariants} className="text-center md:border-r md:border-gray-200">
            <AnimatedCounter value={stats.totalResources} label="Curated Resources" />
          </motion.div>
          <motion.div variants={staggerChildVariants} className="text-center md:border-r md:border-gray-200">
            <AnimatedCounter value={stats.totalSubjects} label="Subjects Covered" />
          </motion.div>
          <motion.div variants={staggerChildVariants} className="text-center">
            <AnimatedCounter value={stats.totalHours} label="Study Hours Mapped" />
          </motion.div>
        </StaggerContainer>

        {/* Tagline */}
        <p className="text-center text-sm font-medium text-gray-500 mb-10">
          Every outcome mapped to official Alberta curriculum documents.
        </p>

        {/* Simplified Dual CTA */}
        <ScrollReveal direction="up">
          <div className="flex flex-col sm:flex-row gap-4 max-w-xl mx-auto">
            <Button
              onClick={handleQuickLearnClick}
              size="lg"
              className="flex-1 h-14 text-lg font-semibold bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-lg"
            >
              <Sparkles className="w-5 h-5 mr-2" />
              {hasSession ? 'Resume Learning' : 'Quick Learn'}
            </Button>
            <Button
              onClick={handlePlanClick}
              size="lg"
              className="flex-1 h-14 text-lg font-semibold bg-blue-600 hover:bg-blue-700 text-white shadow-lg"
            >
              <CheckCircle className="w-5 h-5 mr-2" />
              {hasPlan ? 'Continue Plan' : 'Study Plan'}
            </Button>
          </div>
          <p className="text-center text-sm text-gray-500 mt-4">
            No signup required · 100% free · Data stays on your device
          </p>
        </ScrollReveal>
      </div>
    </section>
  );
}
