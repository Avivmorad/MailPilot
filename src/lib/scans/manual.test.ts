import { describe, expect, it } from "vitest";

import { progressAgeMs } from "@/lib/scans/checkpoint";
import { SCAN_HEARTBEAT_BUSY_MS } from "@/lib/scans/dispatch-budget";
import {
  isManualScanRateLimited,
  MANUAL_SCAN_RATE_LIMIT_MS,
  skipsManualScanRateLimit,
} from "@/lib/scans/manual";

describe("manual scan rate limit", () => {
  it("is two minutes per Gmail connection", () => {
    expect(MANUAL_SCAN_RATE_LIMIT_MS).toBe(120_000);
  });

  it("blocks a second scan inside the window and allows one after it", () => {
    const startedAt = "2026-09-12T12:00:00.000Z";
    const startedMs = Date.parse(startedAt);
    expect(isManualScanRateLimited(startedAt, startedMs + 119_000)).toBe(true);
    expect(isManualScanRateLimited(startedAt, startedMs + 120_000)).toBe(false);
    expect(isManualScanRateLimited(null, startedMs)).toBe(false);
  });

  it("lets Scan now run immediately after a user cancel", () => {
    expect(skipsManualScanRateLimit("cancelled")).toBe(true);
    expect(skipsManualScanRateLimit("stale_lease")).toBe(false);
  });

  it("treats a fresh continuation slice as still busy", () => {
    const updatedAt = "2026-09-14T12:00:00.000Z";
    const age = progressAgeMs({ updatedAt, startedAt: updatedAt }, Date.parse(updatedAt) + 60_000);
    expect(age).toBeLessThan(SCAN_HEARTBEAT_BUSY_MS);
  });
});
