'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { StudyStreak } from '@/lib/types';
import { formatLocalDate, startOfLocalDay } from '@/lib/date';
import QuickActionButton from './QuickActionButton';
import { buildStreakMessage, buildStreakCta, cta as copyCta } from '@/lib/copy';
import * as quickCheckStorage from '@/lib/storage/quick-checks';
import * as progressStorage from '@/lib/storage/progress';

interface StreakHeroProps {
  streak: StudyStreak | null;
  planId?: string;
}

export default function StreakHero({ streak, planId }: StreakHeroProps) {
  const currentStreak = streak?.current_streak || 0;
  const lastStudyDateStr = streak?.last_study_date || null; // YYYY-MM-DD from DB
  const today = startOfLocalDay(new Date());
  const todayStr = formatLocalDate(today);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const yStr = formatLocalDate(yesterday);

  const studiedTodayFromStreak = lastStudyDateStr === todayStr;
  const studiedYesterdayFromStreak = lastStudyDateStr === yStr;

  // Also treat quick-check activity as "studied" for messaging purposes
  const [activityToday, setActivityToday] = useState(false);
  const [activityYesterday, setActivityYesterday] = useState(false);

  useEffect(() => {
    try {
      const twoDaysAgo = new Date(today);
      twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);

      // Get activity from localStorage
      const quickCheckResults = planId
        ? quickCheckStorage.getResultsByPlan(planId)
        : quickCheckStorage.getAllResults();

      const resourceProgress = planId
        ? progressStorage.getResourceProgress(planId)
        : [];

      // Filter to last 2 days and collect dates
      const days = new Set<string>();

      // Quick check activity
      for (const row of quickCheckResults) {
        if (new Date(row.created_at) >= twoDaysAgo) {
          days.add(formatLocalDate(new Date(row.created_at)));
        }
      }

      // Resource completion activity
      for (const row of resourceProgress) {
        if (row.completed && row.started_at && new Date(row.started_at) >= twoDaysAgo) {
          days.add(formatLocalDate(new Date(row.started_at)));
        }
      }

      setActivityToday(days.has(todayStr));
      setActivityYesterday(days.has(yStr));
    } catch {
      // ignore
    }
  }, [planId, today, todayStr, yStr]);

  const studiedToday = studiedTodayFromStreak || activityToday;
  const studiedYesterday = studiedYesterdayFromStreak || activityYesterday;

  let message = '';
  let emoji = '';
  let bgGradient = '';
  let textColor = '';
  let ctaLabel = '';
  let ctaVariant: 'primary' | 'warning' | 'danger' | 'success' = 'primary';
  let shouldPulse = false;

  message = buildStreakMessage({ currentStreak, studiedToday, studiedYesterday });
  const cta = buildStreakCta({ currentStreak, studiedToday, studiedYesterday });
  if (currentStreak > 0 && studiedToday) {
    emoji = '🔥';
    bgGradient = 'bg-gradient-to-br from-green-50 to-emerald-100';
    textColor = 'text-green-700';
    ctaLabel = cta;
    ctaVariant = 'success';
    shouldPulse = false;
  } else if (currentStreak > 0 && studiedYesterday) {
    emoji = '🔥';
    bgGradient = 'bg-gradient-to-br from-orange-50 to-yellow-100';
    textColor = 'text-orange-700';
    ctaLabel = cta;
    ctaVariant = 'warning';
    shouldPulse = true;
  } else if (currentStreak === 0 && studiedToday) {
    // Special case: user studied via quick checks but has no recorded streak yet
    emoji = '✅';
    bgGradient = 'bg-gradient-to-br from-green-50 to-emerald-100';
    textColor = 'text-green-700';
    ctaLabel = copyCta.viewPlan;
    ctaVariant = 'success';
    shouldPulse = false;
    message = 'Nice work today—keep it going.';
  } else if (currentStreak === 0 && !studiedToday && studiedYesterday) {
    emoji = '⚡';
    bgGradient = 'bg-gradient-to-br from-orange-50 to-yellow-100';
    textColor = 'text-orange-700';
    ctaLabel = copyCta.startShortSession;
    ctaVariant = 'warning';
    shouldPulse = true;
    message = 'Pick up from yesterday—one small session today.';
  } else {
    emoji = '⚡';
    bgGradient = 'bg-gradient-to-br from-red-50 to-pink-100';
    textColor = 'text-red-700';
    ctaLabel = cta;
    ctaVariant = 'danger';
    shouldPulse = false;
  }

  return (
    <Card className={`${bgGradient} sticky top-0 z-20 shadow-md md:shadow-lg transition-all`}>
      <div className="flex items-center gap-3 p-4 md:p-6 flex-wrap md:flex-nowrap">
        {/* Emoji with pulse animation */}
        <div
          className={`text-4xl md:text-6xl transition-transform ${
            shouldPulse ? 'animate-pulse' : ''
          }`}
        >
          {emoji}
        </div>

        {/* Message Section */}
        <div className="flex-1 min-w-0">
          <h2 className={`text-lg md:text-2xl font-bold ${textColor} leading-tight`}>
            {message}
          </h2>
          {typeof streak?.longest_streak === 'number' && streak.longest_streak > 0 ? (
            <p className="text-xs md:text-sm text-gray-600 mt-0.5 md:mt-1">
              Longest: {streak.longest_streak} {streak.longest_streak === 1 ? 'day' : 'days'}
            </p>
          ) : null}
        </div>

        {/* CTA Button */}
        <div className="w-full md:w-auto mt-2 md:mt-0">
          <QuickActionButton
            variant={ctaVariant}
            pulse={shouldPulse}
            href={planId ? `/plan/${planId}` : '/dashboard'}
            className="w-full md:w-auto text-sm md:text-base py-2 md:py-2.5"
          >
            {ctaLabel}
          </QuickActionButton>
        </div>
      </div>
    </Card>
  );
}
