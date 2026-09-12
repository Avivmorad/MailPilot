export const SCAN_IN_PROGRESS = "SCAN_IN_PROGRESS";

export const SCAN_USER_MESSAGES = {
  reauth_required:
    "Gmail access expired. Reconnect Gmail to continue scanning. Your existing summaries were kept.",
  gmail_quota:
    "Gmail still blocked the scan after waiting for the per-minute quota. Wait a minute and try a shorter lookback.",
  ai_unavailable: "Email analysis is temporarily unavailable. Your existing summaries were kept.",
  partial_thread_failures:
    "Most emails were processed, but a few could not be analyzed. The system will retry them.",
  scan_failed:
    "The last scan failed. Try again in a few minutes. Your existing summaries were kept.",
  rate_limited: "A scan was started too recently. Please wait two minutes before scanning again.",
  scan_in_progress: "A scan is already running for this Gmail account.",
} as const;

export function scanUserMessage(code: string | null | undefined, fallback?: string | null): string {
  if (code && code in SCAN_USER_MESSAGES) {
    return SCAN_USER_MESSAGES[code as keyof typeof SCAN_USER_MESSAGES];
  }
  if (fallback && !looksLikeProviderError(fallback)) {
    return fallback;
  }
  return SCAN_USER_MESSAGES.scan_failed;
}

function looksLikeProviderError(text: string): boolean {
  return /quota exceeded|invalid_grant|googleapis|gemini|status code|ECONN|stack|thread_failures:/i.test(
    text,
  );
}

export function isAiUnavailableError(error: unknown): boolean {
  if (typeof error === "object" && error && "status" in error) {
    const status = (error as { status?: unknown }).status;
    if (status === 429 || status === 503) {
      return true;
    }
  }
  const message = error instanceof Error ? error.message : String(error);
  return /overloaded|resource.?exhausted|gemini (down|unavailable)|ai (temporarily )?unavailable/i.test(
    message,
  );
}

export function scanStoreFailure(operation: string, detail: string | undefined): Error {
  const suffix = detail?.trim() ? `: ${detail.trim()}` : "";
  return new Error(`${operation}${suffix}`);
}

export function isScanRunUniqueViolation(
  error: { code?: string; message?: string } | null,
): boolean {
  if (!error) {
    return false;
  }
  if (error.code === "23505") {
    return true;
  }
  return /scan_runs_one_running_per_connection/i.test(error.message ?? "");
}

export function isMissingScanSchemaError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /Could not find the table|schema cache|does not exist/i.test(message);
}

export const SCAN_SCHEMA_MISSING_MESSAGE =
  "Apply supabase/migrations in order through 0009_function_hardening.sql in the Supabase SQL Editor, then try Scan now again.";
