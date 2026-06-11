'use client';

import { ScrollReveal } from '@/components/motion';

interface HowItWorksProps {
  id?: string;
}

export default function HowItWorks({ id }: HowItWorksProps = {}) {
  const modes = [
    {
      number: 1,
      title: 'Quick Learn',
      description:
        'Jump right in and start learning. TikTok-style quiz cards make studying feel like scrolling. Perfect for exploring what SteadyTrack has to offer.',
      badge: 'Fun & Interactive',
      icon: '⚡',
      color: 'blue',
    },
    {
      number: 2,
      title: 'Study Plan',
      description:
        'Set your schedule and duration. Get a personalized plan with complete units and curated resources. Track your progress daily and stay on track.',
      badge: 'Structured & Complete',
      icon: '📅',
      color: 'indigo',
    },
  ];

  return (
    <section id={id} className="py-20 bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <ScrollReveal direction="up">
          <div className="text-center mb-16">
            <h2 className="font-display text-4xl sm:text-5xl font-extrabold tracking-tight text-gray-900 mb-4">
              Two Modes, One Mission
            </h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Both aligned with Alberta curriculum. Choose what works for you.
            </p>
          </div>
        </ScrollReveal>

        <div className="grid md:grid-cols-2 gap-8 lg:gap-12 max-w-4xl mx-auto">
          {modes.map((mode, index) => (
            <ScrollReveal key={mode.number} direction={index === 0 ? 'left' : 'right'} delay={index * 0.1}>
              <div className="relative">
                <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl overflow-hidden text-center h-full border-2 border-blue-100">
                  {/* Accent bar */}
                  <div className="h-1.5 bg-blue-600" />
                  <div className="p-8">
                    {/* Structured icon container */}
                    <div className="w-16 h-16 bg-blue-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                      <span className="text-3xl">{mode.icon}</span>
                    </div>

                    <h3 className="font-display text-2xl font-bold text-gray-900 mb-2">
                      {mode.title}
                    </h3>

                    <p className="text-sm font-semibold text-blue-600 mb-4 px-3 py-1 bg-blue-100 rounded-full inline-block">
                      {mode.badge}
                    </p>

                    <p className="text-gray-700 leading-relaxed mt-4">{mode.description}</p>
                  </div>
                </div>
              </div>
            </ScrollReveal>
          ))}
        </div>
      </div>
    </section>
  );
}
