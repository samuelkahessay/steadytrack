'use client';

import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ScrollReveal } from '@/components/motion';

interface FAQItem {
  question: string;
  answer: string;
}

interface FAQProps {
  id?: string;
}

export default function FAQ({ id }: FAQProps = {}) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const faqs: FAQItem[] = [
    {
      question: 'Can I browse the curriculum before creating a plan?',
      answer:
        'Yes! Visit our Curriculum Explorer to browse all 12 subjects with detailed outcomes and resources before creating a study plan.',
    },
    {
      question: 'How is this aligned with the curriculum?',
      answer:
        'Every unit maps directly to official Alberta Education curriculum documents. Grade 12 subjects are aligned with diploma exam requirements.',
    },
    {
      question: 'Will I fall behind during the strike?',
      answer:
        "Not if you stay consistent. Study 30-45 minutes daily to maintain momentum and keep pace with curriculum requirements.",
    },
    {
      question: 'What subjects are covered?',
      answer:
        'Grade 11: Math 20-1, Biology 20, Chemistry 20, Physics 20, English 20-1, Social Studies 20-1. Grade 12: Math 30-1, Biology 30, Chemistry 30, Physics 30, English 30-1, Social Studies 30-1.',
    },
    {
      question: 'Is this really free?',
      answer:
        'Yes, completely free. No credit card, no hidden fees, no premium tiers. Built to help Alberta students stay on track.',
    },
    {
      question: 'How long does it take to set up?',
      answer:
        "Under 1 minute. Select your grade and subjects, and we'll generate your personalized study schedule immediately.",
    },
    {
      question: 'What if the strike ends?',
      answer:
        "Continue using SteadyTrack year-round for exam prep and staying organized through final exams.",
    },
  ];

  return (
    <section id={id} className="py-20 bg-white border-t border-gray-200">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <ScrollReveal direction="up">
          <div className="text-center mb-12">
            <h2 className="font-display text-4xl font-extrabold tracking-tight text-gray-900 mb-4">
              Frequently Asked Questions
            </h2>
            <p className="text-xl text-gray-600">
              Common questions answered
            </p>
          </div>
        </ScrollReveal>

        <div className="space-y-4">
          {faqs.map((faq, index) => (
            <div
              key={index}
              className="border-2 border-gray-200 rounded-xl overflow-hidden hover:border-blue-300 transition-colors"
            >
              <button
                onClick={() => setOpenIndex(openIndex === index ? null : index)}
                className="w-full px-6 py-5 text-left flex justify-between items-center bg-white hover:bg-gray-50 transition-colors"
              >
                <span className="text-lg font-semibold text-gray-900 pr-8">
                  {faq.question}
                </span>
                <motion.svg
                  animate={{ rotate: openIndex === index ? 180 : 0 }}
                  transition={{ duration: 0.25 }}
                  className="w-6 h-6 text-blue-600 flex-shrink-0"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 9l-7 7-7-7"
                  />
                </motion.svg>
              </button>

              <AnimatePresence initial={false}>
                {openIndex === index && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
                    className="overflow-hidden"
                  >
                    <div className="px-6 py-5 bg-gray-50 border-t border-gray-200">
                      <p className="text-gray-700 leading-relaxed">{faq.answer}</p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
