import { describe, expect, it } from "vitest";

import { scanProgressPercent, scanProgressView, latestScanResponseSchema, snapshotProgress } from "@/lib/scans/progress";

describe("scanProgressPercent", () => {
  it("is 0 when nothing has been discovered yet", () => {
    expect(scanProgressPercent(0, 0)).toBe(0);
  });

  it("rounds checked / total", () => {
    expect(scanProgressPercent(1, 3)).toBe(33);
    expect(scanProgressPercent(3, 3)).toBe(100);
  });
});

describe("scanProgressView", () => {
  it("uses an indeterminate finding state before totals exist", () => {
    expect(scanProgressView({ threadsDiscovered: 0, threadsChecked: 0 })).toEqual({
      percent: 0,
      label: "Finding conversations in Gmail…",
      indeterminate: true,
    });
  });

  it("shows checked of total with a percent", () => {
    expect(scanProgressView({ threadsDiscovered: 80, threadsChecked: 12 })).toEqual({
      percent: 15,
      label: "Checked 12 of 80 conversations (15%)",
      indeterminate: false,
    });
  });

  it("parses a latest-scan payload", () => {
    const parsed = latestScanResponseSchema.parse({
      scan: { id: "s1", status: "RUNNING", threads_discovered: 10, threads_checked: 3 },
    });
    expect(snapshotProgress(parsed.scan!)).toEqual({ threadsDiscovered: 10, threadsChecked: 3 });
  });
});
