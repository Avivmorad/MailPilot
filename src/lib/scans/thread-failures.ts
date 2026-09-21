export const MAX_RECORDED_FAILED_THREADS = 50;

const THREAD_ID_PATTERN = /^[a-zA-Z0-9_-]{1,128}$/;

export function formatThreadFailureMessage(gmailThreadIds: string[]): string {
  const unique = [...new Set(gmailThreadIds)].filter((id) => THREAD_ID_PATTERN.test(id));
  const recorded = unique.slice(0, MAX_RECORDED_FAILED_THREADS);
  return `thread_failures:${gmailThreadIds.length}:${recorded.join(",")}`;
}

export function parseThreadFailureIds(errorMessage: string | null | undefined): string[] {
  if (!errorMessage?.startsWith("thread_failures:")) {
    return [];
  }
  const parts = errorMessage.split(":");
  const raw = parts.slice(2).join(":");
  if (!raw) {
    return [];
  }
  const ids = raw
    .split(",")
    .map((id) => id.trim())
    .filter((id) => THREAD_ID_PATTERN.test(id));
  return [...new Set(ids)].slice(0, MAX_RECORDED_FAILED_THREADS);
}

export function mergePendingFailedThreadIds(
  rows: ReadonlyArray<{
    failedThreadIds?: readonly string[] | null;
    errorMessage?: string | null;
  }>,
): string[] {
  const ids = new Set<string>();
  for (const row of rows) {
    for (const id of row.failedThreadIds ?? []) {
      if (THREAD_ID_PATTERN.test(id)) {
        ids.add(id);
      }
    }
    for (const id of parseThreadFailureIds(row.errorMessage)) {
      ids.add(id);
    }
  }
  return [...ids].slice(0, MAX_RECORDED_FAILED_THREADS);
}
