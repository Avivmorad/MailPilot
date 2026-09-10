import { describe, expect, it } from "vitest";

import {
  buildInitialScanQuery,
  DEFAULT_LOOKBACK_DAYS,
  scanWindow,
} from "@/lib/scans/lookback";

describe("buildInitialScanQuery", () => {
  it("excludes spam/trash and uses newer_than for the chosen lookback", () => {
    expect(buildInitialScanQuery(1)).toBe("-in:spam -in:trash newer_than:1d");
    expect(buildInitialScanQuery(3)).toBe("-in:spam -in:trash newer_than:3d");
    expect(buildInitialScanQuery(7)).toBe("-in:spam -in:trash newer_than:7d");
  });

  it("defaults the product lookback to 7 days", () => {
    expect(DEFAULT_LOOKBACK_DAYS).toBe(7);
    expect(buildInitialScanQuery(DEFAULT_LOOKBACK_DAYS)).toContain("newer_than:7d");
  });
});

describe("scanWindow", () => {
  it("ends at now and starts lookbackDays earlier", () => {
    const now = new Date("2026-09-10T12:00:00.000Z");
    const { windowStart, windowEnd } = scanWindow(7, now);
    expect(windowEnd.toISOString()).toBe("2026-09-10T12:00:00.000Z");
    expect(windowStart.toISOString()).toBe("2026-09-03T12:00:00.000Z");
  });
});
