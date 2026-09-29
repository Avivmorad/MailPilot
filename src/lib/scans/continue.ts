import { z } from "zod";

import { createEmailTriageProvider } from "@/lib/ai/client";
import { getTriageModelName } from "@/lib/config/env";
import { persistDigestAfterScan } from "@/lib/digest/build-digest";
import { emitProductEvent } from "@/lib/observability/events";
import { captureSafeException } from "@/lib/observability/sentry-report";
import { createGmailApiForConnection } from "@/lib/gmail/client";
import {
  DISPATCH_LEASE_SECONDS,
  SCAN_CONTINUE_RETRY_MS,
  SCAN_WORK_BUDGET_MS,
} from "@/lib/scans/dispatch-budget";
import { createGmailScanPort } from "@/lib/scans/gmail-port";
import {
  admitScanSlice,
  finishScanJob,
  resolveScanSliceJob,
  SCAN_SLICE_IN_PROGRESS,
} from "@/lib/scans/jobs";
import { executeGmailScan, resumeGmailScan } from "@/lib/scans/process-scan";
import { createSupabaseScanStore } from "@/lib/scans/store";
import { createAdminClient } from "@/lib/supabase/admin";
import { EMPTY_SCAN_COUNTERS, type ScanRunResult } from "@/lib/scans/types";

export const continueScanRequestSchema = z.object({
  scanId: z.string().uuid(),
});

export const SCAN_CONTINUE_TIMEOUT_MS = 10_000;

export function scanAppBaseUrl(
  source: Record<string, string | undefined> = process.env,
): string | null {
  const explicit = source.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "");
  if (explicit) {
    return explicit;
  }
  if (source.VERCEL_URL) {
    return `https://${source.VERCEL_URL.replace(/\/$/, "")}`;
  }
  return null;
}

export async function scheduleScanContinuation(
  scanId: string,
  fetchImpl: typeof fetch = fetch,
): Promise<boolean> {
  const base = scanAppBaseUrl();
  const secret = process.env.CRON_SECRET;
  if (!base || !secret) {
    return false;
  }
  try {
    const response = await fetchImpl(`${base}/api/scans/continue`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${secret}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ scanId }),
      signal: AbortSignal.timeout(SCAN_CONTINUE_TIMEOUT_MS),
    });
    return response.ok;
  } catch {
    return false;
  }
}

export async function scheduleContinueFallback(
  connectionId: string,
  now = new Date(),
): Promise<void> {
  const db = createAdminClient();
  const retryAt = new Date(now.getTime() + SCAN_CONTINUE_RETRY_MS).toISOString();
  const { error } = await db
    .from("gmail_connections")
    .update({ next_scan_at: retryAt })
    .eq("id", connectionId);
  if (error) {
    throw new Error("Failed to schedule scan continuation fallback");
  }
}

export async function chainIfContinued(value: unknown): Promise<void> {
  if (!value || typeof value !== "object" || !("status" in value) || !("scanId" in value)) {
    return;
  }
  const result = value as ScanRunResult;
  if (result.status !== "CONTINUED") {
    return;
  }
  const chained = await scheduleScanContinuation(result.scanId);
  if (chained) {
    return;
  }
  const store = createSupabaseScanStore();
  const checkpoint = await store.getScanCheckpoint(result.scanId);
  if (checkpoint) {
    await scheduleContinueFallback(checkpoint.connectionId);
  }
}

export async function continueScanRun(scanId: string): Promise<ScanRunResult> {
  const requestBudget = { deadlineAt: Date.now() + SCAN_WORK_BUDGET_MS };
  const store = createSupabaseScanStore();
  const status = await store.getScanStatus(scanId);
  const checkpoint = await store.getScanCheckpoint(scanId);
  if (!checkpoint) {
    throw new Error("scan_not_found");
  }
  if (status !== "RUNNING") {
    return {
      scanId,
      status: "FAILED",
      counters: EMPTY_SCAN_COUNTERS,
      lookbackDays: checkpoint.lookbackDays,
      mode: checkpoint.discoveryMode ?? "INITIAL",
    };
  }
  const workerId = `continue:${scanId}:${crypto.randomUUID()}`;
  const leaseExpiresAt = new Date(Date.now() + DISPATCH_LEASE_SECONDS * 1000).toISOString();
  let jobId: string;
  try {
    jobId = await admitScanSlice({
      connectionId: checkpoint.connectionId,
      scanId,
      workerId,
      leaseExpiresAt,
    });
  } catch (error) {
    if (error instanceof Error && error.message === SCAN_SLICE_IN_PROGRESS) {
      return {
        scanId,
        status: "FAILED",
        counters: EMPTY_SCAN_COUNTERS,
        lookbackDays: checkpoint.lookbackDays,
        mode: checkpoint.discoveryMode ?? "INITIAL",
      };
    }
    throw error;
  }

  try {
    const api = await createGmailApiForConnection(checkpoint.connectionId, requestBudget);
    const prepared = await resumeGmailScan({
      scanId,
      gmailEmail: api.gmailEmail,
      gmail: createGmailScanPort(api.gmail, checkpoint.connectionId, requestBudget),
      store,
      provider: createEmailTriageProvider(),
      modelName: getTriageModelName(),
    });
    const result = await executeGmailScan({
      ...prepared,
      jobLease: { jobId, workerId },
    });
    const handoffLease = new Date(Date.now() + DISPATCH_LEASE_SECONDS * 1000).toISOString();
    await resolveScanSliceJob(jobId, result, workerId, handoffLease);
    if (result.status === "SUCCESS" || result.status === "PARTIAL") {
      try {
        await persistDigestAfterScan({ userId: checkpoint.userId, scanId });
      } catch (error) {
        emitProductEvent({ type: "digest.created", scanId, persisted: 0 });
        captureSafeException(error, {
          route: "/api/scans/continue",
          scan_type: "manual",
        });
      }
    }
    return result;
  } catch (error) {
    await finishScanJob(
      jobId,
      "FAILED",
      error instanceof Error ? error.message : "scan_failed",
      workerId,
    ).catch(() => undefined);
    throw error;
  }
}
