export const SCAN_IN_PROGRESS = "SCAN_IN_PROGRESS";

export function scanStoreFailure(operation: string, detail: string | undefined): Error {
  const suffix = detail?.trim() ? `: ${detail.trim()}` : "";
  return new Error(`${operation}${suffix}`);
}

export function isScanRunUniqueViolation(error: { code?: string; message?: string } | null): boolean {
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
  "Apply supabase/migrations/0003_initial_scan.sql and 0005_scan_progress.sql in the Supabase SQL Editor, then try Scan now again.";
