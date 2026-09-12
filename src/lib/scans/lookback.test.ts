import { describe, expect, it } from "vitest";

import {
  buildInitialScanQuery,
  DEFAULT_LOOKBACK_DAYS,
  INITIAL_LOOKBACK_DAYS,
  isInitialLookbackDays,
} from "@/lib/scans/lookback";

describe("initial lookback", () => {
  it("includes windows up to one month and defaults to 7 days", () => {
    expect(INITIAL_LOOKBACK_DAYS).toEqual([1, 2, 3, 4, 7, 14, 21, 30]);
    expect(DEFAULT_LOOKBACK_DAYS).toBe(7);
    expect(isInitialLookbackDays(30)).toBe(true);
    expect(isInitialLookbackDays(31)).toBe(false);
    expect(buildInitialScanQuery(30)).toBe("-in:spam -in:trash newer_than:30d");
  });
});
