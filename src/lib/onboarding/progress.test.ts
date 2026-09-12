import { describe, expect, it } from "vitest";

import { resolveOnboardingStep } from "@/lib/onboarding/progress";

describe("resolveOnboardingStep", () => {
  it("sends a new account to connect Gmail", () => {
    expect(resolveOnboardingStep({ connectionStatus: null, latestScanStatus: null })).toBe(
      "connect_gmail",
    );
  });

  it("keeps disconnected users without a completed scan on connect", () => {
    expect(
      resolveOnboardingStep({ connectionStatus: "DISCONNECTED", latestScanStatus: "FAILED" }),
    ).toBe("connect_gmail");
  });

  it("asks connected users without a completed scan to configure and scan", () => {
    expect(resolveOnboardingStep({ connectionStatus: "CONNECTED", latestScanStatus: null })).toBe(
      "configure_and_scan",
    );
    expect(
      resolveOnboardingStep({ connectionStatus: "CONNECTED", latestScanStatus: "RUNNING" }),
    ).toBe("configure_and_scan");
    expect(
      resolveOnboardingStep({ connectionStatus: "CONNECTED", latestScanStatus: "FAILED" }),
    ).toBe("configure_and_scan");
  });

  it("skips onboarding after a successful or partial scan even if Gmail was later disconnected", () => {
    expect(
      resolveOnboardingStep({ connectionStatus: "DISCONNECTED", latestScanStatus: "SUCCESS" }),
    ).toBe("complete");
    expect(
      resolveOnboardingStep({ connectionStatus: "REAUTH_REQUIRED", latestScanStatus: "PARTIAL" }),
    ).toBe("complete");
  });
});
