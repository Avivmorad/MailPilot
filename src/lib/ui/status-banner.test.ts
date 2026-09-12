import { describe, expect, it } from "vitest";

import { appStatusBanner } from "@/lib/ui/status-banner";

describe("appStatusBanner", () => {
  it("prioritizes Gmail reauth over scan status", () => {
    const banner = appStatusBanner({
      connectionStatus: "REAUTH_REQUIRED",
      scanStatus: "FAILED",
    });
    expect(banner?.actionLabel).toBe("Reconnect Gmail");
    expect(banner?.title).toContain("refreshed");
  });

  it("uses quota and AI-unavailable copy for failed scans", () => {
    expect(
      appStatusBanner({
        connectionStatus: "CONNECTED",
        scanStatus: "FAILED",
        errorCode: "gmail_quota",
      })?.title,
    ).toContain("quota");
    expect(
      appStatusBanner({
        connectionStatus: "CONNECTED",
        scanStatus: "FAILED",
        errorCode: "ai_unavailable",
      })?.title,
    ).toContain("temporarily unavailable");
  });

  it("uses spec copy for a partial scan", () => {
    const banner = appStatusBanner({
      connectionStatus: "CONNECTED",
      scanStatus: "PARTIAL",
    });
    expect(banner?.kind).toBe("warning");
    expect(banner?.body).toBe("The system will retry them.");
  });

  it("hides a running-scan banner on the dashboard", () => {
    expect(
      appStatusBanner({
        connectionStatus: "CONNECTED",
        scanStatus: "RUNNING",
        suppressRunning: true,
      }),
    ).toBeNull();
    expect(
      appStatusBanner({
        connectionStatus: "CONNECTED",
        scanStatus: "RUNNING",
      })?.title,
    ).toBe("A scan is running.");
  });

  it("returns null when nothing needs attention", () => {
    expect(
      appStatusBanner({
        connectionStatus: "CONNECTED",
        scanStatus: "SUCCESS",
      }),
    ).toBeNull();
  });
});
