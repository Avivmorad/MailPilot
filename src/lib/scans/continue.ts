import { z } from "zod";

import { createEmailTriageProvider } from "@/lib/ai/client";
import { getGeminiEnv } from "@/lib/config/env";
import { persistDigestAfterScan } from "@/lib/digest/build-digest";
import { emitProductEvent } from "@/lib/observability/events";
import { createGmailApiForConnection } from "@/lib/gmail/client";
import { SCAN_CONTINUE_RETRY_MS } from "@/lib/scans/dispatch-budget";
import { createGmailScanPort } from "@/lib/scans/gmail-port";
import { executeGmailScan, resumeGmailScan } from "@/lib/scans/process-scan";
import { createSupabaseScanStore } from "@/lib/scans/store";
import { createAdminClient } from "@/lib/supabase/admin";
import { EMPTY_SCAN_COUNTERS, type ScanRunResult } from "@/lib/scans/types";

export const continueScanRequestSchema = z.object({
  scanId: z.string().uuid(),
});

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
  await db.from("gmail_connections").update({ next_scan_at: retryAt }).eq("id", connectionId);
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
  const api = await createGmailApiForConnection(checkpoint.connectionId);
  const prepared = await resumeGmailScan({
    scanId,
    gmailEmail: api.gmailEmail,
    gmail: createGmailScanPort(api.gmail, checkpoint.connectionId),
    store,
    provider: createEmailTriageProvider(),
    modelName: getGeminiEnv().GEMINI_MODEL,
  });
  const result = await executeGmailScan(prepared);
  if (result.status === "SUCCESS" || result.status === "PARTIAL") {
    try {
      await persistDigestAfterScan({ userId: checkpoint.userId, scanId });
    } catch {
      emitProductEvent({ type: "digest.created", scanId, persisted: 0 });
    }
  }
  return result;
}
