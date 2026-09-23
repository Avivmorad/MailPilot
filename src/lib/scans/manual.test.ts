import { describe, expect, it } from "vitest";

import { progressAgeMs, scanHasRemainingWork } from "@/lib/scans/checkpoint";
import { SCAN_HEARTBEAT_BUSY_MS, SCAN_STALE_PROGRESS_MS } from "@/lib/scans/dispatch-budget";
import {
  isManualScanRateLimited,
  MANUAL_SCAN_RATE_LIMIT_MS,
  skipsManualScanRateLimit,
} from "@/lib/scans/manual";
import type { ScanCheckpoint } from "@/lib/scans/types";

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

describe("manual scan resume selection", () => {
  it("resumes stale checkpoints with remaining work instead of opening a new scan", () => {
    const staleCheckpoint: ScanCheckpoint = {
      scanId: "scan-1",
      userId: "user-1",
      connectionId: "conn-1",
      triggerType: "MANUAL",
      lookbackDays: 30,
      discoveryMode: "INITIAL",
      discoveryComplete: true,
      discoveredThreadIds: ["t1", "t2", "t3"],
      threadCursor: 1,
      historyBoundary: "hist-1",
      failedThreadIds: [],
      messagesDiscovered: 3,
      messagesProcessed: 1,
      threadsAnalyzed: 1,
      importantCount: 0,
      actionCount: 0,
      replyCount: 0,
      waitingCount: 0,
      informationalCount: 0,
      ignoredCount: 0,
      startedAt: "2026-09-14T10:00:00.000Z",
      updatedAt: "2026-09-14T10:00:00.000Z",
    };
    const nowMs = Date.parse("2026-09-14T11:00:00.000Z");
    expect(scanHasRemainingWork(staleCheckpoint)).toBe(true);
    expect(progressAgeMs(staleCheckpoint, nowMs)).toBeGreaterThan(SCAN_STALE_PROGRESS_MS);
  });
});
