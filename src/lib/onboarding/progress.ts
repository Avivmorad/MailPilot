import type { GmailConnectionStatus } from "@/lib/gmail/constants";

export const ONBOARDING_STEPS = ["connect_gmail", "configure_and_scan", "complete"] as const;

export type OnboardingStep = (typeof ONBOARDING_STEPS)[number];

export interface OnboardingFacts {
  connectionStatus: GmailConnectionStatus | null;
  latestScanStatus: string | null;
}

const COMPLETED_SCAN_STATUSES = new Set(["SUCCESS", "PARTIAL"]);

export function hasCompletedFirstScan(latestScanStatus: string | null): boolean {
  return latestScanStatus != null && COMPLETED_SCAN_STATUSES.has(latestScanStatus);
}

export function resolveOnboardingStep(facts: OnboardingFacts): OnboardingStep {
  if (hasCompletedFirstScan(facts.latestScanStatus)) {
    return "complete";
  }

  if (facts.connectionStatus === "CONNECTED") {
    return "configure_and_scan";
  }

  return "connect_gmail";
}
