import { createBrowserClient } from "@supabase/ssr";

import { getClientEnv } from "@/lib/config/env";

/**
 * Create a Supabase client for use in client components. Reads only public
 * (`NEXT_PUBLIC_*`) environment variables.
 */
export function createClient() {
  const env = getClientEnv();
  return createBrowserClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}
