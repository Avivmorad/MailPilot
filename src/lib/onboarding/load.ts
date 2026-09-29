import { getGmailStatusForUser } from "@/lib/gmail/connections";
import {
  COMPLETED_SCAN_STATUSES,
  hasCompletedFirstScan,
  resolveOnboardingStep,
  type OnboardingStep,
} from "@/lib/onboarding/progress";
import { getLatestScanRunForUser } from "@/lib/scans/manual";
import { createAdminClient } from "@/lib/supabase/admin";

async function hasCompletedScanForUser(userId: string): Promise<boolean> {
  const db = createAdminClient();
  const { data, error } = await db
    .from("scan_runs")
    .select("id")
    .eq("user_id", userId)
    .in("status", [...COMPLETED_SCAN_STATUSES])
    .limit(1);
  if (error) {
    return false;
  }
  return (data?.length ?? 0) > 0;
}

export async function getOnboardingStepForUser(userId: string): Promise<OnboardingStep> {
  const [gmailStatus, latestScan] = await Promise.all([
    getGmailStatusForUser(userId),
    getLatestScanRunForUser(userId),
  ]);
  const latestScanStatus = latestScan ? String(latestScan.status) : null;
  const hasCompletedScan =
    hasCompletedFirstScan(latestScanStatus) || (await hasCompletedScanForUser(userId));
  return resolveOnboardingStep({
    connectionStatus: gmailStatus.connection?.status ?? null,
    latestScanStatus,
    hasCompletedScan,
  });
}
