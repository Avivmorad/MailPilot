import { describe, expect, it } from "vitest";

import { plannedDiscoveryMode } from "@/lib/scans/mode";

describe("plannedDiscoveryMode", () => {
  it("uses incremental when a historyId and last success exist", () => {
    expect(
      plannedDiscoveryMode({
        historyId: "100",
        lastSuccessfulScanAt: "2026-09-10T08:00:00.000Z",
      }),
    ).toBe("INCREMENTAL");
  });

  it("recovers when last success exists but historyId is missing", () => {
    expect(
      plannedDiscoveryMode({
        historyId: null,
        lastSuccessfulScanAt: "2026-09-10T08:00:00.000Z",
      }),
    ).toBe("RECOVERY");
  });

  it("starts with an initial window scan otherwise", () => {
    expect(plannedDiscoveryMode({ historyId: null, lastSuccessfulScanAt: null })).toBe("INITIAL");
  });

  it("uses a full lookback window when forceLookback is set", () => {
    expect(
      plannedDiscoveryMode(
        { historyId: "100", lastSuccessfulScanAt: "2026-09-10T08:00:00.000Z" },
        { forceLookback: true },
      ),
    ).toBe("INITIAL");
  });
});
