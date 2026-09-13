import { describe, expect, it } from "vitest";

import {
  asLookbackDays,
  parseJsonStringArray,
  progressAgeMs,
  scanHasRemainingWork,
} from "@/lib/scans/checkpoint";
import type { ScanCheckpoint } from "@/lib/scans/types";

function checkpoint(overrides: Partial<ScanCheckpoint> = {}): ScanCheckpoint {
  return {
    scanId: "scan-1",
    userId: "user-1",
    connectionId: "conn-1",
    lookbackDays: 7,
    triggerType: "MANUAL",
    discoveryMode: "INITIAL",
    discoveryComplete: true,
    discoveredThreadIds: ["t1", "t2"],
    threadCursor: 0,
    historyBoundary: "h1",
    failedThreadIds: [],
    messagesDiscovered: 2,
    messagesProcessed: 0,
    threadsAnalyzed: 0,
    importantCount: 0,
    actionCount: 0,
    replyCount: 0,
    waitingCount: 0,
    informationalCount: 0,
    ignoredCount: 0,
    startedAt: "2026-09-10T12:00:00.000Z",
    updatedAt: "2026-09-10T12:00:00.000Z",
    ...overrides,
  };
}

describe("scan checkpoint helpers", () => {
  it("parses string arrays and lookback days", () => {
    expect(parseJsonStringArray(["t1", 2, "t2"])).toEqual(["t1", "t2"]);
    expect(asLookbackDays(30)).toBe(30);
    expect(asLookbackDays("nope")).toBe(7);
  });

  it("detects remaining work and progress age", () => {
    expect(scanHasRemainingWork(checkpoint())).toBe(true);
    expect(scanHasRemainingWork(checkpoint({ threadCursor: 2 }))).toBe(false);
    expect(scanHasRemainingWork(checkpoint({ discoveryComplete: false, threadCursor: 2 }))).toBe(
      true,
    );
    const now = Date.parse("2026-09-10T12:05:00.000Z");
    expect(progressAgeMs(checkpoint(), now)).toBe(5 * 60_000);
  });
});
