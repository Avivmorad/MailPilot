import { z } from "zod";

export const AUTH_OTP_TYPES = [
  "email",
  "signup",
  "recovery",
  "invite",
  "magiclink",
  "email_change",
] as const;

export type AuthOtpType = (typeof AUTH_OTP_TYPES)[number];

export const SAFE_AUTH_NEXT_PATHS = [
  "/login",
  "/login/update-password",
  "/onboarding",
  "/dashboard",
] as const;

export type SafeAuthNextPath = (typeof SAFE_AUTH_NEXT_PATHS)[number];

const authOtpTypeSchema = z.enum(AUTH_OTP_TYPES);

export function parseAuthOtpType(value: string | null): AuthOtpType | null {
  const parsed = authOtpTypeSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

export function defaultAuthNext(type: AuthOtpType | null): SafeAuthNextPath {
  return type === "recovery" ? "/login/update-password" : "/login";
}

/** Only allow same-origin relative app paths. Reject protocol-relative and unknown routes. */
export function safeAuthNext(
  raw: string | null | undefined,
  type: AuthOtpType | null,
): SafeAuthNextPath {
  if (!raw) {
    return defaultAuthNext(type);
  }
  const path = raw.split("?")[0] ?? raw;
  if (!path.startsWith("/") || path.startsWith("//") || path.includes("\\")) {
    return defaultAuthNext(type);
  }
  return (SAFE_AUTH_NEXT_PATHS as readonly string[]).includes(path)
    ? (path as SafeAuthNextPath)
    : defaultAuthNext(type);
}

export function passwordResetRedirectTo(origin: string): string {
  return `${origin.replace(/\/+$/, "")}/auth/confirm?next=/login/update-password`;
}

/** PKCE return path for Supabase Auth Google sign-in (no Gmail scopes). */
export function googleSignInRedirectTo(origin: string): string {
  return `${origin.replace(/\/+$/, "")}/auth/confirm?next=/onboarding`;
}

/**
 * Supabase falls back to Site URL (`/?code=`) when `redirectTo` is missing from
 * the allow list. Forward that PKCE code to the confirm route. Never intercept
 * `/api/*` (Gmail OAuth uses a different `code` on `/api/gmail/callback`).
 */
export function oauthCodeConfirmUrl(url: URL): URL | null {
  if (url.pathname === "/auth/confirm" || url.pathname.startsWith("/api/")) {
    return null;
  }
  const code = url.searchParams.get("code");
  if (!code) {
    return null;
  }
  const next = new URL(url.href);
  next.pathname = "/auth/confirm";
  if (!next.searchParams.get("next")) {
    next.searchParams.set("next", "/onboarding");
  }
  return next;
}
