/**
 * Migration Provider Component
 *
 * This component runs localStorage data migrations on app initialization.
 * It ensures data schema compatibility across app versions.
 *
 * Current migrations:
 * - v1 → v2: Rename completed_at to started_at in progress records
 * - v2 → v3: Transform unit-based plans to outcome-based plans
 *
 * Usage:
 * ```tsx
 * <MigrationProvider>
 *   <YourApp />
 * </MigrationProvider>
 * ```
 */

'use client';

import { useEffect } from 'react';
import { runMigrations } from '@/lib/storage/migrations';

interface MigrationProviderProps {
  children: React.ReactNode;
}

/**
 * MigrationProvider runs data migrations on mount
 *
 * Migrations are:
 * - Idempotent (safe to run multiple times)
 * - Non-blocking (won't prevent app from rendering)
 * - Versioned (only run once per version)
 */
export function MigrationProvider({ children }: MigrationProviderProps) {
  useEffect(() => {
    // Run migrations once on mount
    // This will check the current version and only run pending migrations
    try {
      runMigrations();
    } catch (error) {
      // Log error but don't block app rendering
      console.error('[MigrationProvider] Failed to run migrations:', error);
    }
  }, []);

  // Render children immediately - migrations are non-blocking
  return <>{children}</>;
}
