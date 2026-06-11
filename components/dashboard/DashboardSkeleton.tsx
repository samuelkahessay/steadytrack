'use client';

import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

export default function DashboardSkeleton() {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header Skeleton */}
      <header className="sticky top-0 z-50 bg-white border-b border-gray-200 mb-8">
        <div className="max-w-6xl mx-auto px-4 py-4 flex justify-between items-center">
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-10 w-24" />
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Title Skeleton */}
        <div className="mb-8">
          <Skeleton className="h-10 w-80 mb-2" />
          <Skeleton className="h-5 w-64" />
        </div>

        {/* Streak Hero Skeleton */}
        <Card className="p-6 mb-8">
          <div className="flex items-center gap-4">
            <Skeleton className="w-16 h-16 rounded-full" />
            <div className="flex-1">
              <Skeleton className="h-8 w-64 mb-2" />
              <Skeleton className="h-4 w-48" />
            </div>
          </div>
        </Card>

        {/* Weekly Summary Skeleton */}
        <Card className="mb-8">
          <CardHeader>
            <Skeleton className="h-6 w-48" />
          </CardHeader>
          <CardContent>
            <div className="flex gap-2 justify-between mb-4">
              {Array.from({ length: 7 }).map((_, i) => (
                <div key={i} className="flex flex-col items-center">
                  <Skeleton className="w-10 h-10 rounded-full mb-1" />
                  <Skeleton className="h-3 w-8" />
                </div>
              ))}
            </div>
            <div className="pt-4 border-t space-y-2">
              <Skeleton className="h-4 w-48" />
              <Skeleton className="h-4 w-40" />
            </div>
          </CardContent>
        </Card>

        {/* Subject Progress Cards Grid Skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-6 w-32 mb-2" />
                <Skeleton className="h-4 w-24" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-3 w-full mb-3 rounded-full" />
                <Skeleton className="h-4 w-40" />
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Today's Focus Skeleton */}
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-32" />
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Skeleton className="h-4 w-24 mb-2" />
              <Skeleton className="h-6 w-48 mb-2" />
              <Skeleton className="h-4 w-32" />
            </div>
            <Skeleton className="h-10 w-full" />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
