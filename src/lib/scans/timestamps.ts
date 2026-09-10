/**
 * Persist only values Postgres can store as timestamptz. Gemini may emit
 * free-text waiting_since; those must not fail the thread upsert.
 */
export function timestampOrNull(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }
  const ms = Date.parse(value);
  if (!Number.isFinite(ms)) {
    return null;
  }
  return new Date(ms).toISOString();
}
