import { describe, expect, it } from "vitest";

import {
  scanProgressPercent,
  scanProgressView,
  latestScanResponseSchema,
  snapshotProgress,
} from "@/lib/scans/progress";

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

  it("uses discovering label when running before totals exist", () => {
    expect(scanProgressView({ threadsDiscovered: 0, threadsChecked: 0, status: "RUNNING" })).toEqual({
      percent: 0,
      label: "Discovering conversations in Gmail…",
      indeterminate: true,
    });
  });

  it("reports stopped scan when failed before totals exist", () => {
    expect(scanProgressView({ threadsDiscovered: 0, threadsChecked: 0, status: "FAILED" })).toEqual({
      percent: 0,
      label: "Scan stopped before conversations were checked.",
      indeterminate: false,
    });
  });

  it("distinguishes running phase when 0 conversations have been triaged yet", () => {
    expect(scanProgressView({ threadsDiscovered: 40, threadsChecked: 0, status: "RUNNING" })).toEqual({
      percent: 0,
      label: "Discovered 40 conversations; fetching and triaging…",
      indeterminate: false,
    });
  });

  it("distinguishes active in-flight running triage progress", () => {
    expect(scanProgressView({ threadsDiscovered: 80, threadsChecked: 20, status: "RUNNING" })).toEqual({
      percent: 25,
      label: "Checking 20 of 80 conversations (25%)…",
      indeterminate: false,
    });
  });

  it("caps running progress at 99% while finalizing labels and storing results", () => {
    expect(scanProgressView({ threadsDiscovered: 50, threadsChecked: 50, status: "RUNNING" })).toEqual({
      percent: 99,
      label: "Finalizing triage and labels for 50 conversations…",
      indeterminate: false,
    });
  });

  it("honestly reports partial scans without claiming 100% completion", () => {
    expect(
      scanProgressView({
        threadsDiscovered: 20,
        threadsChecked: 20,
        status: "PARTIAL",
        errorCode: "partial_thread_failures",
      }),
    ).toEqual({
      percent: 95,
      label: "Checked 20 of 20 conversations (partially completed, retries queued)",
      indeterminate: false,
    });
  });

  it("explains quota pause on failure", () => {
    expect(
      scanProgressView({
        threadsDiscovered: 30,
        threadsChecked: 10,
        status: "FAILED",
        errorCode: "gmail_quota",
      }),
    ).toEqual({
      percent: 33,
      label: "Paused due to Gmail rate limit after 10 of 30 conversations.",
      indeterminate: false,
    });
  });

  it("explains AI unavailability pause on failure", () => {
    expect(
      scanProgressView({
        threadsDiscovered: 30,
        threadsChecked: 5,
        status: "FAILED",
        errorCode: "ai_unavailable",
      }),
    ).toEqual({
      percent: 17,
      label: "Paused due to AI service unavailability after 5 of 30 conversations.",
      indeterminate: false,
    });
  });

  it("explains reconnect requirement on failure", () => {
    expect(
      scanProgressView({
        threadsDiscovered: 30,
        threadsChecked: 2,
        status: "FAILED",
        errorCode: "reauth_required",
      }),
    ).toEqual({
      percent: 7,
      label: "Paused: Gmail reconnect required after 2 of 30 conversations.",
      indeterminate: false,
    });
  });

  it("reports 100% on full success", () => {
    expect(scanProgressView({ threadsDiscovered: 15, threadsChecked: 15, status: "SUCCESS" })).toEqual({
      percent: 100,
      label: "Checked 15 of 15 conversations (100%)",
      indeterminate: false,
    });
  });

  it("parses a latest-scan payload and extracts status and errorCode in snapshotProgress", () => {
    const parsed = latestScanResponseSchema.parse({
      scan: {
        id: "s1",
        status: "RUNNING",
        threads_discovered: 10,
        threads_checked: 3,
        error_code: null,
      },
    });
    expect(snapshotProgress(parsed.scan!)).toEqual({
      threadsDiscovered: 10,
      threadsChecked: 3,
      status: "RUNNING",
      errorCode: null,
    });
  });
});
