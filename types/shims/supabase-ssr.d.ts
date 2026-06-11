// Local type shim to avoid incompatibilities between @supabase/ssr and
// @supabase/supabase-js generic constraints when skipLibCheck is disabled.
// Runtime behavior still uses the real package; this only affects TypeScript.

/* eslint-disable @typescript-eslint/no-explicit-any */
declare module '@supabase/ssr' {
  import type { SupabaseClient } from '@supabase/supabase-js'

  // Loosen the generic constraints to avoid cross-package type mismatch.
  export function createBrowserClient<_Database = any, _SchemaName = any, _Schema = any>(
    supabaseUrl: string,
    supabaseKey: string,
    // Options are purposely typed as any to avoid constraint errors
    options?: any
  ): SupabaseClient<any, any, any>

  export function createServerClient<_Database = any, _SchemaName = any, _Schema = any>(
    supabaseUrl: string,
    supabaseKey: string,
    options?: any
  ): SupabaseClient<any, any, any>
}

