import { z } from "zod";

/**
 * Server-side environment schema.
 *
 * These values include secrets and must never be imported into client
 * components. Validation is intentionally lazy (see {@link getServerEnv}) so
 * that the app can boot, render public pages, and build without every secret
 * being present. Any server code that actually needs a secret calls
 * `getServerEnv()` and fails fast with a clear message if it is missing.
 */
const serverEnvSchema = z.object({
  NEXT_PUBLIC_APP_URL: z.string().min(1).optional(),

  NEXT_PUBLIC_SUPABASE_URL: z.string().min(1),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),

  GOOGLE_CLIENT_ID: z.string().min(1),
  GOOGLE_CLIENT_SECRET: z.string().min(1),
  GOOGLE_REDIRECT_URI: z.string().min(1),

  TOKEN_ENCRYPTION_KEY: z.string().min(1),

  OPENAI_API_KEY: z.string().min(1),
  OPENAI_MODEL: z.string().min(1),

  CRON_SECRET: z.string().min(1),

  MAX_THREAD_MESSAGES: z.coerce.number().int().positive().default(6),
  MAX_MESSAGE_CHARS: z.coerce.number().int().positive().default(12000),
  MAX_THREAD_CHARS: z.coerce.number().int().positive().default(35000),
  AI_MAX_CONCURRENCY: z.coerce.number().int().positive().default(5),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

/**
 * Client-side environment schema. Only `NEXT_PUBLIC_*` values are allowed here
 * because anything referenced in the browser bundle is public.
 */
const clientEnvSchema = z.object({
  NEXT_PUBLIC_APP_URL: z.string().min(1).optional(),
  NEXT_PUBLIC_SUPABASE_URL: z.string().min(1),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
});

export type ClientEnv = z.infer<typeof clientEnvSchema>;

function formatIssues(error: z.ZodError): string {
  return error.issues
    .map((issue) => `  - ${issue.path.join(".") || "(root)"}: ${issue.message}`)
    .join("\n");
}

/**
 * Parse an arbitrary source into a validated {@link ServerEnv}. Exported so it
 * can be unit tested without touching `process.env`.
 */
export function parseServerEnv(source: Record<string, unknown> = process.env): ServerEnv {
  const parsed = serverEnvSchema.safeParse(source);
  if (!parsed.success) {
    throw new Error(
      `Invalid or missing server environment variables:\n${formatIssues(parsed.error)}`,
    );
  }
  return parsed.data;
}

export function parseClientEnv(source: Record<string, unknown>): ClientEnv {
  const parsed = clientEnvSchema.safeParse(source);
  if (!parsed.success) {
    throw new Error(
      `Invalid or missing public environment variables:\n${formatIssues(parsed.error)}`,
    );
  }
  return parsed.data;
}

let cachedServerEnv: ServerEnv | null = null;

/**
 * Lazily validate and cache the server environment. Call this only from
 * server-side code paths that require configured secrets.
 */
export function getServerEnv(): ServerEnv {
  if (cachedServerEnv === null) {
    cachedServerEnv = parseServerEnv();
  }
  return cachedServerEnv;
}

/**
 * Validate the public environment. Safe to call from both server and client.
 * Next.js inlines `NEXT_PUBLIC_*` variables at build time, so they are read
 * explicitly rather than iterated.
 */
export function getClientEnv(): ClientEnv {
  return parseClientEnv({
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  });
}
