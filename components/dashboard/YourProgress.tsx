'use client';

import CollapsibleSection from './CollapsibleSection';
import { WeeklySummaryStats, UserProgress } from '@/lib/types';
import { formatLocalDate, startOfLocalDay } from '@/lib/date';
import { buildStudyPulseMessage } from '@/lib/copy';

interface YourProgressProps {
  summary: WeeklySummaryStats | null;
  progress: UserProgress[];
  defaultExpanded?: boolean;
}

export default function YourProgress({
  summary,
  progress: _progress,
  defaultExpanded = false,
}: YourProgressProps) {
  // Weekly summary data
  const activityDates = summary?.activityDates ?? [];
  const totalUnitsThisWeek = summary?.totalUnits ?? 0;
  const activitySet = new Set(activityDates);
  const daysStudiedCount = activitySet.size;

  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const today = new Date();
  const dayOfWeek = (today.getDay() + 6) % 7; // Convert to Monday = 0

  const startOfWeek = new Date(today);
  startOfWeek.setHours(0, 0, 0, 0);
  startOfWeek.setDate(startOfWeek.getDate() - dayOfWeek);

  const dayMarkers = days.map((day, index) => {
    const dayDate = new Date(startOfWeek);
    dayDate.setDate(startOfWeek.getDate() + index);
    const dateStr = formatLocalDate(dayDate);
    const hasActivity = activitySet.has(dateStr);

    return {
      day,
      hasActivity,
    };
  });

  const weekCompletionPercentage = Math.round((daysStudiedCount / 7) * 100);

  // Study pulse data (last 4 days)
  const todayStart = startOfLocalDay(new Date());
  const dayStrings = Array.from({ length: 4 }, (_, i) => {
    const d = new Date(todayStart);
    d.setDate(d.getDate() - i);
    return formatLocalDate(d);
  });

  // Use weekly summary's activity dates (includes both unit completions
  // and quick-check answers) for pulse and "studied today" detection.
  const activitySetForPulse = new Set(activityDates);

  const studiedToday = activitySetForPulse.has(dayStrings[0]);
  const activeDays = dayStrings.filter((ds) => activitySetForPulse.has(ds)).length;
  const totalDays = 4;
  const pulsePercentage = Math.round((activeDays / totalDays) * 100);

  // Determine message and color for pulse
  let pulseMessage = '';
  let pulseColor = '';

  if (pulsePercentage >= 75) {
    pulseMessage = buildStudyPulseMessage(pulsePercentage, studiedToday);
    pulseColor = 'text-green-700';
  } else if (pulsePercentage >= 50) {
    pulseMessage = buildStudyPulseMessage(pulsePercentage, studiedToday);
    pulseColor = 'text-yellow-700';
  } else if (studiedToday) {
    pulseMessage = buildStudyPulseMessage(pulsePercentage, studiedToday);
    pulseColor = 'text-blue-700';
  } else {
    pulseMessage = buildStudyPulseMessage(pulsePercentage, studiedToday);
    pulseColor = 'text-gray-700';
  }

  return (
    <CollapsibleSection
      title="Your Progress"
      defaultExpanded={defaultExpanded}
      storageKey="dashboard-progress-expanded"
      className="shadow-sm"
    >
      <div className="space-y-6 pt-2">
        {/* Weekly Activity */}
        <div>
          <h4 className="text-sm font-semibold text-gray-900 mb-3">This Week</h4>
          <div className="flex gap-2 justify-between mb-4">
            {dayMarkers.map(({ day, hasActivity }) => (
              <div key={day} className="flex flex-col items-center">
                <div
                  className={`w-9 h-9 rounded-full flex items-center justify-center transition-all ${
                    hasActivity
                      ? 'bg-green-500 text-white scale-110'
                      : 'bg-gray-200 text-gray-500'
                  }`}
                >
                  {hasActivity ? '✓' : ''}
                </div>
                <span className="text-xs text-gray-600 mt-1">{day}</span>
              </div>
            ))}
          </div>

          <div className="space-y-1.5 text-sm text-gray-600">
            <p>
              <span className="font-semibold">{totalUnitsThisWeek}</span> units completed
            </p>
            <p>
              Studied <span className="font-semibold">{daysStudiedCount}</span> of 7 days{' '}
              <span className="text-gray-400">({weekCompletionPercentage}%)</span>
            </p>
          </div>
        </div>

        {/* Divider */}
        <div className="border-t border-gray-200" />

        {/* Study Pulse */}
        <div>
          <h4 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <span>📊</span>
            Last 4 Days
          </h4>

          {/* Progress Bar */}
          <div className="mb-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700">Activity</span>
              <span className={`text-base font-bold ${pulseColor}`}>
                {pulsePercentage}%
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2.5">
              <div
                className={`h-2.5 rounded-full transition-all duration-700 ${
                  pulsePercentage >= 75
                    ? 'bg-green-500'
                    : pulsePercentage >= 50
                    ? 'bg-yellow-500'
                    : 'bg-gray-400'
                }`}
                style={{ width: `${pulsePercentage}%` }}
              />
            </div>
          </div>

          <div className="space-y-1.5 text-sm">
            <p className="text-gray-600">
              Studied <span className="font-semibold">{activeDays}</span> of{' '}
              <span className="font-semibold">{totalDays}</span> days
            </p>
            <p className={`font-semibold ${pulseColor}`}>{pulseMessage}</p>
          </div>
        </div>
      </div>
    </CollapsibleSection>
  );
}
