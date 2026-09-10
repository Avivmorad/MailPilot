import { createClient as createSupabaseClient } from "@supabase/supabase-js";

import { getSupabaseAdminEnv } from "@/lib/config/env";

/**
 * Create a privileged Supabase client using the service role key. This bypasses
 * Row Level Security and must only ever be used in trusted server-side contexts
 * (background scans, cron jobs). Never import this into client code.
 */
export function createAdminClient() {
  const env = getSupabaseAdminEnv();

  return createSupabaseClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
