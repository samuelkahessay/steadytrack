'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { getPlan } from '@/lib/storage/plan';

interface ProblemSolutionCardProps {
  icon: string;
  title: string;
  problem: string;
  solution: string;
  ctaText: string;
  audience: 'student' | 'parent' | 'trust';
}

export default function ProblemSolutionCard({
  icon,
  title,
  problem,
  solution,
  ctaText,
}: ProblemSolutionCardProps) {
  const router = useRouter();
  const [hasPlan, setHasPlan] = useState(false);

  useEffect(() => {
    const plan = getPlan();
    setHasPlan(plan !== null && plan.status === 'active');
  }, []);

  const handleCTAClick = () => {
    if (hasPlan) {
      router.push('/dashboard');
    } else {
      router.push('/plan/new');
    }
  };

  return (
    <Card className="p-8 hover:shadow-xl transition-shadow border-2 border-gray-100 hover:border-blue-200 border-l-4 border-l-blue-600 flex flex-col h-full">
      {/* Structured icon container */}
      <div className="w-16 h-16 bg-blue-100 rounded-2xl flex items-center justify-center mb-4">
        <span className="text-3xl">{icon}</span>
      </div>

      <h3 className="font-display text-2xl font-bold text-gray-900 mb-3">{title}</h3>

      <div className="mb-4 flex-grow">
        <div className="border-l-2 border-l-red-400 pl-3 mb-3">
          <p className="text-lg font-semibold text-red-600">&quot;{problem}&quot;</p>
        </div>
        <p className="text-gray-700 leading-relaxed">{solution}</p>
      </div>

      <Button
        onClick={handleCTAClick}
        className="w-full mt-4 bg-blue-600 hover:bg-blue-700"
        size="lg"
      >
        {ctaText}
      </Button>
    </Card>
  );
}
