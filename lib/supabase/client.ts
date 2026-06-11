/**
 * Supabase client for anonymous read-only access to content
 * Used ONLY for reading curriculum content and microcards
 * NO AUTHENTICATION - all auth functionality disabled
 *
 * Phase 4: Local-First Migration Complete
 * - Auth completely disabled
 * - Only used for public content (microcards, curriculum)
 * - All user data now stored in localStorage
 */

import { createBrowserClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';

let client: SupabaseClient | undefined;

/**
 * Get anonymous Supabase client for content-only access
 *
 * ⚠️ WARNING: This client has auth DISABLED
 * Do NOT use for:
 * - User authentication (.auth methods will fail)
 * - User data storage (use localStorage instead)
 * - Any auth-dependent queries
 *
 * ONLY use for:
 * - Reading public microcards (content_microcards table)
 * - Reading public curriculum data
 */
export function getSupabaseClient() {
  if (!client) {
    client = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false,
          flowType: 'implicit',
        },
      }
    );
  }
  return client;
}
