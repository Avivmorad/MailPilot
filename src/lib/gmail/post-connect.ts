import { ensureManagedLabels } from "@/lib/gmail/labels";
import { nextDailyScanAt } from "@/lib/scans/schedule";
import { getScanPreferences } from "@/lib/settings/preferences";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Non-critical Connect Gmail follow-up work. Safe to run after the OAuth
 * redirect response is sent. Labels are also reconciled on the next scan if
 * this step is interrupted.
 */
export async function runGmailPostConnectSetup(input: {
  userId: string;
  connectionId: string;
  accessToken: string;
  refreshToken: string;
  nextScanAt: string | null;
}): Promise<void> {
  if (!input.nextScanAt) {
    try {
      const preferences = await getScanPreferences(input.userId);
      const nextScanAt = nextDailyScanAt(
        new Date(),
        preferences.dailyScanTime,
        preferences.timezone,
      ).toISOString();
      const db = createAdminClient();
      await db
        .from("gmail_connections")
        .update({ next_scan_at: nextScanAt })
        .eq("id", input.connectionId);
    } catch {
      // Connection is valid; the next successful scan will set next_scan_at.
    }
  }

  try {
    await ensureManagedLabels(input.connectionId, input.accessToken, input.refreshToken);
  } catch {
    // Connection is still valid; labels can be reconciled on the next scan.
  }
}
