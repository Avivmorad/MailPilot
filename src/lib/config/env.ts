import { z } from "zod";

/**
 * Environment validation is split by phase so the app can run without every
 * later-phase secret. Public pages only need {@link getClientEnv}. Gmail OAuth
 * (Phase 2) uses {@link getGmailEnv}. Full {@link getServerEnv} is for later
 * phases that actually call Gemini / cron.
 *
 * Secrets must never be imported into client components.
 */

const supabasePublicSchema = z.object({
  NEXT_PUBLIC_APP_URL: z.string().min(1).optional(),
  NEXT_PUBLIC_SUPABASE_URL: z.string().min(1),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
});

const supabaseAdminSchema = supabasePublicSchema.extend({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
});

const gmailEnvSchema = supabaseAdminSchema.extend({
  GOOGLE_CLIENT_ID: z.string().min(1),
  GOOGLE_CLIENT_SECRET: z.string().min(1),
  GOOGLE_REDIRECT_URI: z.string().min(1),
  TOKEN_ENCRYPTION_KEY: z.string().min(1),
});

const contextLimitsSchema = z.object({
  MAX_THREAD_MESSAGES: z.coerce.number().int().positive().default(6),
  MAX_MESSAGE_CHARS: z.coerce.number().int().positive().default(12000),
  MAX_THREAD_CHARS: z.coerce.number().int().positive().default(35000),
  AI_MAX_CONCURRENCY: z.coerce.number().int().positive().default(2),
  /** Local budget under Google's typical 15,000 units/user/minute. */
  GMAIL_QUOTA_UNITS_PER_MINUTE: z.coerce.number().int().positive().default(12_000),
});

export type ContextLimits = z.infer<typeof contextLimitsSchema>;

const geminiEnvSchema = z.object({
  GEMINI_API_KEY: z.string().min(1),
  GEMINI_MODEL: z.string().min(1),
});

const serverEnvSchema = gmailEnvSchema
  .extend({
    CRON_SECRET: z.string().min(1),
  })
  .merge(geminiEnvSchema)
  .merge(contextLimitsSchema);

export type ClientEnv = z.infer<typeof supabasePublicSchema>;
export type SupabaseAdminEnv = z.infer<typeof supabaseAdminSchema>;
export type GmailEnv = z.infer<typeof gmailEnvSchema>;
export type GeminiEnv = z.infer<typeof geminiEnvSchema>;
export type ServerEnv = z.infer<typeof serverEnvSchema>;

function formatIssues(error: z.ZodError): string {
  return error.issues
    .map((issue) => `  - ${issue.path.join(".") || "(root)"}: ${issue.message}`)
    .join("\n");
}

function throwInvalid(kind: string, error: z.ZodError): never {
  throw new Error(`Invalid or missing ${kind} environment variables:\n${formatIssues(error)}`);
}

export function parseClientEnv(source: Record<string, unknown>): ClientEnv {
  const parsed = supabasePublicSchema.safeParse(source);
  if (!parsed.success) throwInvalid("public", parsed.error);
  return parsed.data;
}

export function parseSupabaseAdminEnv(
  source: Record<string, unknown> = process.env,
): SupabaseAdminEnv {
  const parsed = supabaseAdminSchema.safeParse(source);
  if (!parsed.success) throwInvalid("Supabase admin", parsed.error);
  return parsed.data;
}

export function parseGmailEnv(source: Record<string, unknown> = process.env): GmailEnv {
  const parsed = gmailEnvSchema.safeParse(source);
  if (!parsed.success) throwInvalid("Gmail OAuth", parsed.error);
  return parsed.data;
}

export function parseGeminiEnv(source: Record<string, unknown> = process.env): GeminiEnv {
  const parsed = geminiEnvSchema.safeParse(source);
  if (!parsed.success) throwInvalid("Gemini", parsed.error);
  return parsed.data;
}

export function parseServerEnv(source: Record<string, unknown> = process.env): ServerEnv {
  const parsed = serverEnvSchema.safeParse(source);
  if (!parsed.success) throwInvalid("server", parsed.error);
  return parsed.data;
}

export function isGmailConfigured(source: Record<string, unknown> = process.env): boolean {
  return gmailEnvSchema.safeParse(source).success;
}

export function isGeminiConfigured(source: Record<string, unknown> = process.env): boolean {
  return geminiEnvSchema.safeParse(source).success;
}

export function getClientEnv(): ClientEnv {
  return parseClientEnv({
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  });
}

let cachedAdminEnv: SupabaseAdminEnv | null = null;
let cachedGmailEnv: GmailEnv | null = null;
let cachedGeminiEnv: GeminiEnv | null = null;
let cachedServerEnv: ServerEnv | null = null;

export function getSupabaseAdminEnv(): SupabaseAdminEnv {
  if (cachedAdminEnv === null) {
    cachedAdminEnv = parseSupabaseAdminEnv();
  }
  return cachedAdminEnv;
}

export function getGmailEnv(): GmailEnv {
  if (cachedGmailEnv === null) {
    cachedGmailEnv = parseGmailEnv();
  }
  return cachedGmailEnv;
}

export function getGeminiEnv(): GeminiEnv {
  if (cachedGeminiEnv === null) {
    cachedGeminiEnv = parseGeminiEnv();
  }
  return cachedGeminiEnv;
}

export function getContextLimits(source: Record<string, unknown> = process.env): ContextLimits {
  return contextLimitsSchema.parse(source);
}

export function getServerEnv(): ServerEnv {
  if (cachedServerEnv === null) {
    cachedServerEnv = parseServerEnv();
  }
  return cachedServerEnv;
}
