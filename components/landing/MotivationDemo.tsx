'use client';

import { useRef } from 'react';
import { useInView } from 'framer-motion';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { ScrollReveal } from '@/components/motion';

export default function MotivationDemo() {
  const progressRef = useRef<HTMLDivElement>(null);
  const isProgressInView = useInView(progressRef, { once: true, margin: '-80px' });

  return (
    <section className="py-20 bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <ScrollReveal direction="up">
          <div className="text-center mb-12">
            <h2 className="font-display text-4xl sm:text-5xl font-extrabold tracking-tight text-gray-900 mb-4">
              Track Your Progress
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Build momentum with streaks and instant feedback on your consistency.
            </p>
          </div>
        </ScrollReveal>

        <div className="grid lg:grid-cols-2 gap-8 max-w-5xl mx-auto">
          {/* Streak Demo */}
          <ScrollReveal direction="left">
            <div>
              <div className="bg-gradient-to-br from-green-50 to-emerald-100 rounded-2xl p-8 shadow-lg border-2 border-green-200">
                <div className="flex items-center gap-4 mb-6">
                  <div className="text-6xl">🔥</div>
                  <div>
                    <h3 className="font-display text-2xl font-bold text-green-700">4-Day Streak</h3>
                    <p className="text-gray-600">Longest: 7 days</p>
                  </div>
                </div>
                <button className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors shadow-md">
                  View My Plan
                </button>
              </div>
              <div className="mt-4 space-y-2 text-sm text-gray-600">
                <p className="flex items-start gap-2">
                  <span className="text-green-600 font-bold">✓</span>
                  <span>
                    <strong>Build Momentum:</strong> Daily streaks create powerful study habits
                  </span>
                </p>
                <p className="flex items-start gap-2">
                  <span className="text-green-600 font-bold">✓</span>
                  <span>
                    <strong>Celebrate Milestones:</strong> Track your longest streak
                  </span>
                </p>
              </div>
            </div>
          </ScrollReveal>

          {/* Study Pulse Demo */}
          <ScrollReveal direction="right">
            <div ref={progressRef}>
              <Card className="bg-green-50 shadow-lg border-2 border-green-200">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    Study Pulse
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {/* Progress Bar */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-gray-700">
                          Last 4 Days
                        </span>
                        <span className="text-lg font-bold text-green-700">75%</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-3">
                        <div
                          className="bg-green-500 h-3 rounded-full transition-all duration-1000 ease-out"
                          style={{ width: isProgressInView ? '75%' : '0%' }}
                        />
                      </div>
                    </div>

                    {/* Stats */}
                    <p className="text-sm text-gray-600">
                      You studied <span className="font-semibold">3</span> of the last{' '}
                      <span className="font-semibold">4</span> days
                    </p>

                    {/* Message */}
                    <p className="text-sm font-semibold text-green-700">Excellent consistency.</p>
                  </div>
                </CardContent>
              </Card>
              <div className="mt-4 space-y-2 text-sm text-gray-600">
                <p className="flex items-start gap-2">
                  <span className="text-blue-600 font-bold">✓</span>
                  <span>
                    <strong>Instant Feedback:</strong> See your weekly consistency
                  </span>
                </p>
                <p className="flex items-start gap-2">
                  <span className="text-blue-600 font-bold">✓</span>
                  <span>
                    <strong>Stay Accountable:</strong> Get encouragement when you need it
                  </span>
                </p>
              </div>
            </div>
          </ScrollReveal>
        </div>

        {/* Weekly Progress Visual */}
        <ScrollReveal direction="up" delay={0.1}>
          <div className="mt-12 max-w-2xl mx-auto">
            <div className="bg-white rounded-xl border-2 border-gray-200 p-6 shadow-lg">
              <h3 className="font-semibold text-gray-900 mb-4 text-center">
                Weekly Progress
              </h3>
              <div className="flex gap-1.5 sm:gap-3 justify-between mb-4">
                {[
                  { day: 'Mon', completed: true },
                  { day: 'Tue', completed: true },
                  { day: 'Wed', completed: true },
                  { day: 'Thu', completed: true },
                  { day: 'Fri', completed: false },
                  { day: 'Sat', completed: false },
                  { day: 'Sun', completed: false },
                ].map((item) => (
                  <div key={item.day} className="flex flex-col items-center flex-1">
                    <div
                      className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center text-sm font-semibold ${
                        item.completed
                          ? 'bg-green-500 text-white'
                          : 'bg-gray-200 text-gray-500'
                      }`}
                    >
                      {item.completed ? '✓' : ''}
                    </div>
                    <span className="text-[10px] sm:text-xs text-gray-600 mt-1">{item.day}</span>
                  </div>
                ))}
              </div>
              <p className="text-sm text-gray-600 text-center">
                <span className="font-semibold">12</span> units completed this week
              </p>
            </div>
          </div>
        </ScrollReveal>
      </div>
    </section>
  );
}
