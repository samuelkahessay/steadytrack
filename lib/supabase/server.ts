/**
 * Supabase server client for anonymous read-only access to content
 * Used in API routes and server components for reading public data
 * NO AUTHENTICATION - anonymous access only
 */

import { getLocalServerClient } from "@/lib/local-db/server";

/**
 * Get anonymous Supabase client for server-side content access
 * Only used for reading public content (microcards, curriculum)
 * No cookie handling or auth needed
 */
export function getServerClient() {
  return getLocalServerClient();
}
