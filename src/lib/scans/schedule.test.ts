import { describe, expect, it } from "vitest";

import { nextDailyScanAt, nextScanAfterFailure, scheduledRetryAt } from "@/lib/scans/schedule";

describe("nextDailyScanAt", () => {
  it("returns today's 08:00 Asia/Jerusalem when that time is still ahead", () => {
    // 05:00 IDT (UTC+3) on 10 Sep 2026 is before 08:00.
    const now = new Date("2026-09-10T02:00:00.000Z");
    const next = nextDailyScanAt(now, "08:00", "Asia/Jerusalem");
    expect(next.toISOString()).toBe("2026-09-10T05:00:00.000Z");
  });

  it("returns tomorrow's 08:00 Asia/Jerusalem after that time has passed", () => {
    // 09:00 IDT is after 08:00.
    const now = new Date("2026-09-10T06:00:00.000Z");
    const next = nextDailyScanAt(now, "08:00", "Asia/Jerusalem");
    expect(next.toISOString()).toBe("2026-09-11T05:00:00.000Z");
  });

  it("rolls to the next calendar day when now is exactly the scan time", () => {
    const now = new Date("2026-09-10T05:00:00.000Z");
    const next = nextDailyScanAt(now, "08:00", "Asia/Jerusalem");
    expect(next.toISOString()).toBe("2026-09-11T05:00:00.000Z");
  });
});

describe("scheduledRetryAt", () => {
  const now = new Date("2026-09-10T05:00:00.000Z");

  it("uses a 15-minute first retry", () => {
    expect(scheduledRetryAt(now, 1).toISOString()).toBe("2026-09-10T05:15:00.000Z");
  });

  it("falls back to the next daily slot after the attempt cap", () => {
    const next = nextScanAfterFailure(now, 3, "08:00", "Asia/Jerusalem");
    expect(next.toISOString()).toBe("2026-09-11T05:00:00.000Z");
  });
});
