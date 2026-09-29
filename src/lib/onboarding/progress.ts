import type { GmailConnectionStatus } from "@/lib/gmail/constants";

export const ONBOARDING_STEPS = ["connect_gmail", "configure_and_scan", "complete"] as const;

export type OnboardingStep = (typeof ONBOARDING_STEPS)[number];

export interface OnboardingFacts {
  connectionStatus: GmailConnectionStatus | null;
  latestScanStatus: string | null;
  /** True when any successful or partial scan exists, including one that is not the latest run. */
  hasCompletedScan: boolean;
}

export const COMPLETED_SCAN_STATUSES = ["SUCCESS", "PARTIAL"] as const;

export function hasCompletedFirstScan(latestScanStatus: string | null): boolean {
  return (
    latestScanStatus != null &&
    (COMPLETED_SCAN_STATUSES as readonly string[]).includes(latestScanStatus)
  );
}

export function resolveOnboardingStep(facts: OnboardingFacts): OnboardingStep {
  if (facts.hasCompletedScan || hasCompletedFirstScan(facts.latestScanStatus)) {
    return "complete";
  }

  if (facts.connectionStatus === "CONNECTED") {
    return "configure_and_scan";
  }

  return "connect_gmail";
}
