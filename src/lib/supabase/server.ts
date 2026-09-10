import { cookies } from "next/headers";

import { createServerClient } from "@supabase/ssr";

import { getClientEnv } from "@/lib/config/env";

/**
 * Create a request-scoped Supabase client for Server Components, Route
 * Handlers, and Server Actions. Uses the anon key and forwards the user's
 * session via cookies so Row Level Security is enforced as the signed-in user.
 */
export async function createClient() {
  const cookieStore = await cookies();
  const env = getClientEnv();

  return createServerClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // `setAll` can be called from a Server Component where mutating
          // cookies is not allowed. This is safe to ignore when middleware is
          // responsible for refreshing sessions.
        }
      },
    },
  });
}
