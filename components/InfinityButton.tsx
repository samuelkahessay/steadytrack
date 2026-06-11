'use client';

import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Infinity as InfinityIcon } from 'lucide-react';

export function InfinityButton() {
  const router = useRouter();

  return (
    <Button
      onClick={() => router.push('/learn/infinite')}
      size="lg"
      className="bg-white hover:bg-gray-50 text-indigo-700 font-bold shadow-lg hover:shadow-xl transition-all duration-300 group border-2 border-white/50"
    >
      <InfinityIcon className="w-6 h-6 mr-2" />
      <span>Start Learning</span>
    </Button>
  );
}
