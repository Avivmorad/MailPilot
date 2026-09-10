import { createEmailTriageProvider } from "@/lib/ai/client";
import { getGeminiEnv, isGeminiConfigured, isGmailConfigured } from "@/lib/config/env";
import { persistDigestAfterScan } from "@/lib/digest/build-digest";
import { createGmailApiForConnection } from "@/lib/gmail/client";
import { GmailConnectError } from "@/lib/gmail/oauth";
import { authorizeCronRequest } from "@/lib/scans/cron-auth";
import { createGmailScanPort } from "@/lib/scans/gmail-port";
import {
  createScanJob,
  failStaleActiveJobs,
  finishScanJob,
  incrementScanJobAttempt,
  markScanJobRunning,
} from "@/lib/scans/jobs";
import { claimDueConnections, releaseConnectionLease, SCAN_LEASE_SECONDS } from "@/lib/scans/leases";
import { DEFAULT_LOOKBACK_DAYS } from "@/lib/scans/lookback";
import { openGmailScan, executeGmailScan } from "@/lib/scans/process-scan";
import { nextScanAfterFailure } from "@/lib/scans/schedule";
import { createSupabaseScanStore } from "@/lib/scans/store";
import { createAdminClient } from "@/lib/supabase/admin";

export { authorizeCronRequest };

export type DispatcherResultStatus = "SUCCESS" | "PARTIAL" | "FAILED" | "SKIPPED";

export interface DispatcherConnectionResult {
  connectionId: string;
  status: DispatcherResultStatus;
  scanId?: string;
  error?: string;
}

async function setNextScanAt(connectionId: string, nextScanAt: string): Promise<void> {
  const db = createAdminClient();
  const { error } = await db.from("gmail_connections").update({ next_scan_at: nextScanAt }).eq("id", connectionId);
  if (error) {
    throw new Error("Failed to schedule next scan");
  }
}

async function runClaimedConnection(
  claimed: { id: string; userId: string; gmailEmail: string },
  workerId: string,
  now: Date,
): Promise<DispatcherConnectionResult> {
  const leaseExpiresAt = new Date(now.getTime() + SCAN_LEASE_SECONDS * 1000).toISOString();
  let jobId: string | null = null;
  let attempt = 0;

  try {
    try {
      await failStaleActiveJobs(claimed.id, now);
      const job = await createScanJob({
        connectionId: claimed.id,
        workerId,
        leaseExpiresAt,
      });
      jobId = job.id;
      attempt = await incrementScanJobAttempt(job.id);
    } catch {
      await setNextScanAt(claimed.id, new Date(now.getTime() + 5 * 60_000).toISOString());
      return { connectionId: claimed.id, status: "SKIPPED", error: "scan_job_in_progress" };
    }

    if (!isGmailConfigured() || !isGeminiConfigured()) {
      throw new Error("not_configured");
    }

    const api = await createGmailApiForConnection(claimed.id);
    const prepared = await openGmailScan({
      userId: api.userId,
      connectionId: claimed.id,
      gmailEmail: api.gmailEmail,
      lookbackDays: DEFAULT_LOOKBACK_DAYS,
      triggerType: "SCHEDULED",
      gmail: createGmailScanPort(api.gmail, claimed.id),
      store: createSupabaseScanStore(),
      provider: createEmailTriageProvider(),
      modelName: getGeminiEnv().GEMINI_MODEL,
      now,
    });

    if (!jobId) {
      throw new Error("scan_job_missing");
    }
    await markScanJobRunning(jobId, prepared.scanId);
    const result = await executeGmailScan(prepared);

    if (result.status === "SUCCESS" || result.status === "PARTIAL") {
      try {
        await persistDigestAfterScan({ userId: api.userId, scanId: prepared.scanId });
      } catch (error) {
        console.error("[digest]", {
          scanId: prepared.scanId,
          error: error instanceof Error ? error.message : "digest_failed",
        });
      }
    }

    await finishScanJob(jobId, "SUCCESS", null);
    return { connectionId: claimed.id, status: result.status, scanId: prepared.scanId };
  } catch (error) {
    const message = error instanceof Error ? error.message : "scan_failed";
    if (message === "SCAN_IN_PROGRESS") {
      if (jobId) {
        await finishScanJob(jobId, "FAILED", "scan_in_progress");
      }
      await setNextScanAt(claimed.id, new Date(now.getTime() + 5 * 60_000).toISOString());
      return { connectionId: claimed.id, status: "SKIPPED", error: "scan_in_progress" };
    }

    if (jobId) {
      await finishScanJob(jobId, "FAILED", message).catch(() => undefined);
    }
    if (attempt < 1) {
      attempt = 1;
    }

    const store = createSupabaseScanStore();
    const settings = await store.getSettings(claimed.userId).catch(() => ({
      dailyScanTime: "08:00",
      timezone: "Asia/Jerusalem",
      vipSenders: [],
      ignoredSenders: [],
    }));
    const retryAt = nextScanAfterFailure(
      now,
      attempt,
      settings.dailyScanTime ?? "08:00",
      settings.timezone || "Asia/Jerusalem",
    );
    await setNextScanAt(claimed.id, retryAt.toISOString());

    if (error instanceof GmailConnectError && error.reason === "reauth_required") {
      return { connectionId: claimed.id, status: "FAILED", error: "reauth_required" };
    }
    return { connectionId: claimed.id, status: "FAILED", error: message };
  } finally {
    await releaseConnectionLease(claimed.id).catch(() => undefined);
  }
}

export async function dispatchDueScans(options: {
  now?: Date;
  limit?: number;
  workerId?: string;
} = {}): Promise<{ claimed: number; results: DispatcherConnectionResult[] }> {
  const now = options.now ?? new Date();
  const workerId = options.workerId ?? `dispatcher:${crypto.randomUUID()}`;
  const claimed = await claimDueConnections({
    workerId,
    limit: options.limit ?? 3,
    now,
  });

  const results: DispatcherConnectionResult[] = [];
  for (const connection of claimed) {
    results.push(await runClaimedConnection(connection, workerId, now));
  }
  return { claimed: claimed.length, results };
}
