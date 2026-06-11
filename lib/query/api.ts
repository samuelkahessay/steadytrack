/**
 * Base API Utility Functions
 *
 * This file provides reusable API client functions for React Query hooks.
 *
 * It handles:
 * - Supabase client integration
 * - Error handling and response parsing
 * - Type-safe request/response interfaces
 * - Consistent error messages
 *
 * Usage:
 * ```ts
 * const { data } = useQuery({
 *   queryKey: queryKeys.streaks.byUser(userId),
 *   queryFn: () => fetchStreak(supabase, userId),
 * })
 * ```
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import type { StudyStreak, UserProgress, StudyPlan } from '@/lib/types';

/**
 * Base error class for API errors
 */
export class ApiError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public code?: string
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/**
 * Fetch user's current streak
 */
export async function fetchStreak(
  supabase: SupabaseClient<Database>,
  userId: string
): Promise<StudyStreak | null> {
  const { data, error } = await supabase
    .from('study_streaks')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    throw new ApiError(
      `Failed to fetch streak: ${error.message}`,
      undefined,
      error.code
    );
  }

  return data;
}

/**
 * Fetch user's progress for a specific plan
 */
export async function fetchProgress(
  supabase: SupabaseClient<Database>,
  userId: string,
  planId: string
): Promise<UserProgress[]> {
  const { data, error } = await supabase
    .from('user_progress')
    .select('*')
    .eq('user_id', userId)
    .eq('plan_id', planId);

  if (error) {
    throw new ApiError(
      `Failed to fetch progress: ${error.message}`,
      undefined,
      error.code
    );
  }

  return data || [];
}

/**
 * Fetch a specific study plan
 */
export async function fetchPlan(
  supabase: SupabaseClient<Database>,
  planId: string
): Promise<StudyPlan> {
  const { data, error } = await supabase
    .from('study_plans')
    .select('*')
    .eq('id', planId)
    .single();

  if (error) {
    throw new ApiError(
      `Failed to fetch plan: ${error.message}`,
      undefined,
      error.code
    );
  }

  return data as StudyPlan;
}

/**
 * Fetch user's active study plan
 */
export async function fetchActivePlan(
  supabase: SupabaseClient<Database>,
  userId: string
): Promise<StudyPlan | null> {
  const { data, error } = await supabase
    .from('study_plans')
    .select('*')
    .eq('user_id', userId)
    .eq('is_active', true)
    .maybeSingle();

  if (error) {
    throw new ApiError(
      `Failed to fetch active plan: ${error.message}`,
      undefined,
      error.code
    );
  }

  return data as StudyPlan | null;
}

/**
 * Fetch quick check results for a plan
 */
export async function fetchQuickCheckResults(
  supabase: SupabaseClient<Database>,
  userId: string,
  planId: string
): Promise<Array<{ created_at: string }>> {
  const { data, error } = await supabase
    .from('quick_check_results')
    .select('created_at')
    .eq('user_id', userId)
    .eq('plan_id', planId);

  if (error) {
    throw new ApiError(
      `Failed to fetch quick check results: ${error.message}`,
      undefined,
      error.code
    );
  }

  return data || [];
}

/**
 * Fetch resource progress for a plan
 */
export async function fetchResourceProgress(
  supabase: SupabaseClient<Database>,
  userId: string,
  planId: string
): Promise<Array<{ completed_at: string }>> {
  const { data, error } = await supabase
    .from('resource_progress')
    .select('completed_at')
    .eq('user_id', userId)
    .eq('plan_id', planId)
    .eq('completed', true);

  if (error) {
    throw new ApiError(
      `Failed to fetch resource progress: ${error.message}`,
      undefined,
      error.code
    );
  }

  return data || [];
}

/**
 * Fetch microcards for a subject and outcome codes
 */
export async function fetchMicrocards(
  supabase: SupabaseClient<Database>,
  subject: string,
  outcomeCodes: string[]
) {
  if (outcomeCodes.length === 0) {
    return [];
  }

  const { data, error } = await supabase
    .from('content_microcards')
    .select('*')
    .eq('subject', subject)
    .in('outcome_code', outcomeCodes)
    .eq('status', 'active')
    .order('outcome_code');

  if (error) {
    throw new ApiError(
      `Failed to fetch microcards: ${error.message}`,
      undefined,
      error.code
    );
  }

  return data || [];
}

/**
 * Fetch user profile
 */
export async function fetchProfile(
  supabase: SupabaseClient<Database>,
  userId: string
) {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();

  if (error) {
    throw new ApiError(
      `Failed to fetch profile: ${error.message}`,
      undefined,
      error.code
    );
  }

  return data;
}

/**
 * Update user profile
 */
export async function updateProfile(
  supabase: SupabaseClient,
  userId: string,
  updates: { display_name?: string | null; grade?: number; timezone?: string }
) {
  const { data, error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', userId)
    .select()
    .single();

  if (error) {
    throw new ApiError(
      `Failed to update profile: ${error.message}`,
      undefined,
      error.code
    );
  }

  return data;
}

/**
 * Fetch user's most recent study plan (for settings page)
 */
export async function fetchUserPlanForSettings(
  supabase: SupabaseClient<Database>,
  userId: string
): Promise<StudyPlan | null> {
  const { data, error } = await supabase
    .from('study_plans')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new ApiError(
      `Failed to fetch plan: ${error.message}`,
      undefined,
      error.code
    );
  }

  return data as StudyPlan | null;
}

/**
 * Fetch share link for user
 */
export async function fetchShareLink(
  supabase: SupabaseClient<Database>,
  userId: string
): Promise<string | null> {
  const { data, error } = await supabase
    .from('parent_access')
    .select('share_token')
    .eq('student_user_id', userId)
    .eq('is_active', true)
    .maybeSingle();

  if (error) {
    throw new ApiError(
      `Failed to fetch share link: ${error.message}`,
      undefined,
      error.code
    );
  }

  const shareToken = (data as { share_token: string } | null)?.share_token;
  if (!shareToken) {
    return null;
  }

  // Construct full URL
  const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
  return `${baseUrl}/share/${shareToken}`;
}
