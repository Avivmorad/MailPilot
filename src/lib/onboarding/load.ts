import { getGmailStatusForUser } from "@/lib/gmail/connections";
import { resolveOnboardingStep, type OnboardingStep } from "@/lib/onboarding/progress";
import { getLatestScanRunForUser } from "@/lib/scans/manual";

export async function getOnboardingStepForUser(userId: string): Promise<OnboardingStep> {
  const [gmailStatus, latestScan] = await Promise.all([
    getGmailStatusForUser(userId),
    getLatestScanRunForUser(userId),
  ]);
  return resolveOnboardingStep({
    connectionStatus: gmailStatus.connection?.status ?? null,
    latestScanStatus: latestScan ? String(latestScan.status) : null,
  });
}
