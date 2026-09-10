export const INITIAL_LOOKBACK_DAYS = [1, 3, 7] as const;
export type InitialLookbackDays = (typeof INITIAL_LOOKBACK_DAYS)[number];

export const DEFAULT_LOOKBACK_DAYS: InitialLookbackDays = 7;

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

export function scanWindow(lookbackDays: InitialLookbackDays, now: Date = new Date()): {
  windowStart: Date;
  windowEnd: Date;
} {
  const windowEnd = new Date(now.getTime());
  const windowStart = new Date(now.getTime() - lookbackDays * 24 * 60 * 60 * 1000);
  return { windowStart, windowEnd };
}
