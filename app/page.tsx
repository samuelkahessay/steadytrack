'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import Hero from '@/components/landing/Hero';
import SubjectBrowser from '@/components/landing/SubjectBrowser';
import StickyNav from '@/components/landing/StickyNav';
import ProblemSolutionCard from '@/components/landing/ProblemSolutionCard';
import CurriculumShowcase from '@/components/landing/CurriculumShowcase';
import MotivationDemo from '@/components/landing/MotivationDemo';
import HowItWorks from '@/components/landing/HowItWorks';
import FAQ from '@/components/landing/FAQ';
import Footer from '@/components/landing/Footer';
import Testimonials from '@/components/landing/Testimonials';
import { ScrollReveal, StaggerContainer } from '@/components/motion';
import { staggerChildVariants } from '@/components/motion/StaggerContainer';

export default function Home() {
  return (
    <main className="min-h-screen">
      {/* ========== STICKY NAVIGATION ========== */}
      <StickyNav />

      {/* Content */}
      <div className="mt-16">
        {/* ========== 2. HERO ========== */}
        <Hero />

      {/* ========== 3. QUICK SUBJECT BROWSER ========== */}
      <SubjectBrowser />

      {/* ========== 4. TESTIMONIALS ========== */}
      <Testimonials />

      {/* ========== 5. HOW IT WORKS ========== */}
      <HowItWorks id="how-it-works" />

      {/* ========== 6. BUILT ON THE REAL ALBERTA CURRICULUM ========== */}
      <CurriculumShowcase />

      {/* ========== 7. BUILT FOR ALBERTA STUDENTS ========== */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <ScrollReveal direction="up">
            <div className="text-center mb-16">
              <h2 className="font-display text-4xl sm:text-5xl font-extrabold tracking-tight text-gray-900 mb-4">
                Built for Alberta Students
              </h2>
              <p className="text-xl text-gray-600 max-w-3xl mx-auto">
                We understand the unique challenges of staying on track during the strike
              </p>
            </div>
          </ScrollReveal>

          <StaggerContainer staggerDelay={0.15} className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            <motion.div variants={staggerChildVariants}>
              <ProblemSolutionCard
                icon="📚"
                title="For Students"
                problem="Will I fall behind?"
                solution="Stay organized with a curriculum-aligned study plan. Build daily momentum with streaks and progress tracking. Feel confident you're on track for diploma exams."
                ctaText="Start Tracking Progress"
                audience="student"
              />
            </motion.div>

            <motion.div variants={staggerChildVariants}>
              <ProblemSolutionCard
                icon="🎓"
                title="Can You Trust This?"
                problem="Is this reliable?"
                solution="Built by a Sir Winston Churchill High School alumnus and Western University computer science alumnus. Completely free, curriculum-aligned with Alberta diploma exam requirements, and privacy-focused."
                ctaText="Get Started"
                audience="trust"
              />
            </motion.div>
          </StaggerContainer>
        </div>
      </section>

      {/* ========== 8. STAY MOTIVATED WITH DAILY TRACKING ========== */}
      <MotivationDemo />

      {/* ========== 9. FAQ ========== */}
      <FAQ id="faq" />

      {/* ========== 10. FINAL CTA ========== */}
      <ScrollReveal direction="up">
        <section className="py-20 bg-gradient-to-br from-blue-600 to-indigo-700">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <h2 className="font-display text-4xl sm:text-5xl font-extrabold tracking-tight text-white mb-6">
              Start Your Free Plan
            </h2>
            <p className="text-xl text-blue-100 mb-8">
              Get organized in under 1 minute. No signup required.
            </p>
            <Link
              href="/plan/new"
              className="inline-block bg-white text-blue-600 hover:bg-gray-100 font-semibold text-lg px-10 py-4 rounded-lg shadow-xl transition-all hover:scale-105"
            >
              Create Your Study Plan
            </Link>
          </div>
        </section>
      </ScrollReveal>

      {/* ========== FOOTER ========== */}
      <Footer />
      </div>
    </main>
  );
}
