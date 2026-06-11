'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function PlanGradeSelectionPage() {
  const router = useRouter();

  useEffect(() => {
    // Replace current history entry to avoid back button navigation trap
    router.replace('/plan/new/subjects');
  }, [router]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center px-4">
      <div className="text-center">
        <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-gray-600">Loading...</p>
      </div>
    </div>
  );
}
