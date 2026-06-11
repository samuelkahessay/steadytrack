'use client';

import { ScrollReveal } from '@/components/motion';

export default function Testimonials() {
  // Single testimonial - can be easily updated
  const testimonial = {
    name: "Atharva Roy",
    role: "Grade 11 IB Student, Sir Winston Churchill High School",
    quote: "When the strike started, it was overwhelming. All the structure of school was just gone in an instant, during a really important time for my university applications. SteadyTrack helped immensely, providing planned schedules so I didn't hyperfocus and burn out on a subject, while compiling resources that made self-learning over the strike much less daunting."
  };

  return (
    <section className="py-20 bg-gradient-to-br from-blue-50 to-indigo-50">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <ScrollReveal direction="up">
          <div className="text-center mb-12">
            <h2 className="font-display text-4xl sm:text-5xl font-extrabold tracking-tight text-gray-900 mb-4">
              What Students Are Saying
            </h2>
          </div>
        </ScrollReveal>

        {/* Single centered testimonial card */}
        <ScrollReveal direction="up" delay={0.15}>
          <div className="bg-white rounded-2xl shadow-xl p-8 sm:p-12 border border-gray-200 border-l-4 border-l-blue-600">
            <div className="flex flex-col items-center text-center">
              {/* Quote icon */}
              <svg
                className="w-12 h-12 text-blue-600 mb-6"
                fill="currentColor"
                viewBox="0 0 24 24"
              >
                <path d="M14.017 21v-7.391c0-5.704 3.731-9.57 8.983-10.609l.995 2.151c-2.432.917-3.995 3.638-3.995 5.849h4v10h-9.983zm-14.017 0v-7.391c0-5.704 3.748-9.57 9-10.609l.996 2.151c-2.433.917-3.996 3.638-3.996 5.849h3.983v10h-9.983z" />
              </svg>

              {/* Quote */}
              <p className="text-xl sm:text-2xl text-gray-700 font-medium leading-relaxed mb-8">
                {testimonial.quote}
              </p>

              {/* Attribution */}
              <div>
                <p className="text-lg font-semibold text-gray-900">
                  {testimonial.name}
                </p>
                <p className="text-sm text-gray-600 mt-1">
                  {testimonial.role}
                </p>
              </div>
            </div>
          </div>
        </ScrollReveal>
      </div>
    </section>
  );
}
