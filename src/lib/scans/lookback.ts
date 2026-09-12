export const INITIAL_LOOKBACK_DAYS = [1, 2, 3, 4, 7, 14, 21, 30] as const;
export type InitialLookbackDays = (typeof INITIAL_LOOKBACK_DAYS)[number];

export const DEFAULT_LOOKBACK_DAYS: InitialLookbackDays = 7;

export const LOOKBACK_OPTION_LABELS: Record<InitialLookbackDays, string> = {
  1: "Last 1 day",
  2: "Last 2 days",
  3: "Last 3 days",
  4: "Last 4 days",
  7: "Last week",
  14: "Last 2 weeks",
  21: "Last 3 weeks",
  30: "Last month",
};

export function isInitialLookbackDays(value: number): value is InitialLookbackDays {
  return (INITIAL_LOOKBACK_DAYS as readonly number[]).includes(value);
}

/**
 * Gmail search for an initial scan window. Excludes spam/trash; includes sent
 * mail so WAITING threads can be detected (spec §7.1).
 */
export function buildInitialScanQuery(lookbackDays: InitialLookbackDays): string {
  return `-in:spam -in:trash newer_than:${lookbackDays}d`;
}

export function scanWindow(
  lookbackDays: InitialLookbackDays,
  now: Date = new Date(),
): {
  windowStart: Date;
  windowEnd: Date;
} {
  const windowEnd = new Date(now.getTime());
  const windowStart = new Date(now.getTime() - lookbackDays * 24 * 60 * 60 * 1000);
  return { windowStart, windowEnd };
}

export const HISTORY_OVERLAP_MS = 60 * 60 * 1000;

export function overlapWindowStart(lastSuccessfulScanAt: Date, now: Date = new Date()): Date {
  const overlapped = new Date(lastSuccessfulScanAt.getTime() - HISTORY_OVERLAP_MS);
  return overlapped.getTime() < now.getTime() ? overlapped : now;
}

/**
 * Recovery query after a stale historyId (spec §7.2): last success minus 1 hour.
 */
export function buildOverlapScanQuery(lastSuccessfulScanAt: Date, now: Date = new Date()): string {
  const start = overlapWindowStart(lastSuccessfulScanAt, now);
  const epochSeconds = Math.floor(start.getTime() / 1000);
  return `-in:spam -in:trash after:${epochSeconds}`;
}
