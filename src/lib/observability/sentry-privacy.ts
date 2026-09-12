import type { Breadcrumb, Event } from "@sentry/nextjs";

import { isAiUnavailableError } from "@/lib/scans/errors";
import type { ScanTriggerType } from "@/lib/scans/types";

export const SENTRY_TAG_KEYS = [
  "environment",
  "route",
  "provider",
  "scan_type",
  "error_category",
] as const;

export type SentryTagKey = (typeof SENTRY_TAG_KEYS)[number];
export type SentryProviderTag = "gmail" | "gemini" | "supabase" | "unknown";
export type SentryScanTypeTag = "initial" | "manual" | "recovery" | "scheduled";
export type SentryErrorCategoryTag = "reauth" | "quota" | "ai" | "partial" | "store" | "unknown";

export type SentrySafeTags = Partial<
  Record<SentryTagKey, string> & {
    provider: SentryProviderTag;
    scan_type: SentryScanTypeTag;
    error_category: SentryErrorCategoryTag;
  }
>;

const EMAIL_RE = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const SECRET_RE = /bearer\s+[a-z0-9._~+/=-]+|ya29\.[a-z0-9._-]+|sk-[a-z0-9]+|eyj[a-z0-9_-]+\.[a-z0-9._-]+|\b[a-f0-9]{64}\b/gi;
const UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/gi;
const ALLOWED_TAG_SET = new Set<string>(SENTRY_TAG_KEYS);

export function sentryEnvironment(
  source: Record<string, string | undefined> = typeof process === "undefined" ? {} : process.env,
): string {
  return (
    source.NEXT_PUBLIC_VERCEL_ENV ||
    source.VERCEL_ENV ||
    source.NODE_ENV ||
    "development"
  );
}

export function sentryScanType(trigger: ScanTriggerType): SentryScanTypeTag {
  switch (trigger) {
    case "INITIAL":
      return "initial";
    case "MANUAL":
      return "manual";
    case "RECOVERY":
      return "recovery";
    case "SCHEDULED":
      return "scheduled";
  }
}

export function sentryProviderFromError(error: unknown): SentryProviderTag {
  const message = error instanceof Error ? error.message : String(error);
  if (/gmail|googleapis|invalid_grant|reauth/i.test(message)) {
    return "gmail";
  }
  if (/gemini|generative.?language|ai_unavailable/i.test(message)) {
    return "gemini";
  }
  if (/supabase|schema cache|scan_runs|Could not find the table/i.test(message)) {
    return "supabase";
  }
  return "unknown";
}

export function sentryErrorCategoryFromError(error: unknown): SentryErrorCategoryTag {
  const message = error instanceof Error ? error.message : String(error);
  if (/reauth_required|invalid_grant|REAUTH/i.test(message)) {
    return "reauth";
  }
  if (/gmail_quota|quota exceeded/i.test(message)) {
    return "quota";
  }
  if (isAiUnavailableError(error) || /ai_unavailable/i.test(message)) {
    return "ai";
  }
  if (/partial_thread_failures|thread_failures:/i.test(message)) {
    return "partial";
  }
  if (/supabase|schema cache|scan_runs|Failed to/i.test(message)) {
    return "store";
  }
  return "unknown";
}

export function sanitizeSentryRoute(raw: string | undefined): string | undefined {
  if (!raw) {
    return undefined;
  }
  const path = raw.startsWith("http") ? safePathname(raw) : raw.split("?")[0] ?? raw;
  if (!path.startsWith("/")) {
    return path.replace(UUID_RE, "[id]");
  }
  return path.replace(UUID_RE, "[id]");
}

export function redactSensitiveText(value: string): string {
  return value.replace(EMAIL_RE, "[email]").replace(SECRET_RE, "[redacted]");
}

export function pickAllowedSentryTags(
  tags: Partial<Record<SentryTagKey, string | undefined>>,
): Partial<Record<SentryTagKey, string>> {
  const next: Partial<Record<SentryTagKey, string>> = {};
  for (const key of SENTRY_TAG_KEYS) {
    const value = tags[key];
    if (typeof value === "string" && value.length > 0) {
      next[key] = redactSensitiveText(value);
    }
  }
  return next;
}

export function sanitizeSentryEvent(event: Event): Event | null {
  if (event.type === "replay_event" || event.type === "feedback") {
    return null;
  }

  const route = existingTag(event, "route") ?? sanitizeSentryRoute(event.request?.url ?? event.transaction);
  const allowed = pickAllowedSentryTags({
    environment: existingTag(event, "environment") ?? event.environment ?? sentryEnvironment(),
    route,
    provider: asAllowedTag(event, "provider"),
    scan_type: asAllowedTag(event, "scan_type"),
    error_category: asAllowedTag(event, "error_category"),
  } satisfies Partial<Record<SentryTagKey, string | undefined>>);

  return {
    ...event,
    message: event.message ? redactSensitiveText(event.message) : event.message,
    logentry: event.logentry
      ? {
          ...event.logentry,
          message: event.logentry.message ? redactSensitiveText(event.logentry.message) : event.logentry.message,
          params: undefined,
        }
      : event.logentry,
    user: undefined,
    extra: undefined,
    breadcrumbs: sanitizeBreadcrumbs(event.breadcrumbs),
    request: event.request
      ? {
          method: event.request.method,
          url: sanitizeSentryRoute(event.request.url),
        }
      : undefined,
    exception: event.exception
      ? {
          values: event.exception.values?.map((value) => ({
            ...value,
            value: value.value ? redactSensitiveText(value.value) : value.value,
          })),
        }
      : event.exception,
    tags: allowed,
    contexts: {
      ...(event.contexts?.trace ? { trace: event.contexts.trace } : {}),
      ...(event.contexts?.app ? { app: event.contexts.app } : {}),
      ...(event.contexts?.os ? { os: event.contexts.os } : {}),
      ...(event.contexts?.runtime ? { runtime: event.contexts.runtime } : {}),
    },
    spans: undefined,
  };
}

function existingTag(event: Event, key: SentryTagKey): string | undefined {
  const value = event.tags?.[key];
  return typeof value === "string" ? value : undefined;
}

function asAllowedTag(event: Event, key: SentryTagKey): string | undefined {
  const value = existingTag(event, key);
  return value && ALLOWED_TAG_SET.has(key) ? value : undefined;
}

function sanitizeBreadcrumbs(breadcrumbs: Breadcrumb[] | undefined): Breadcrumb[] | undefined {
  if (!breadcrumbs) {
    return undefined;
  }
  return breadcrumbs.map((crumb) => ({
    timestamp: crumb.timestamp,
    category: crumb.category,
    type: crumb.type,
    level: crumb.level,
  }));
}

function safePathname(value: string): string {
  try {
    return new URL(value).pathname;
  } catch {
    return value.split("?")[0] ?? value;
  }
}
