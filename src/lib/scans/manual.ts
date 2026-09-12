import { z } from "zod";

import { createEmailTriageProvider } from "@/lib/ai/client";
import { getGeminiEnv, isGeminiConfigured, isGmailConfigured } from "@/lib/config/env";
import { createGmailApiForUser } from "@/lib/gmail/client";
import { GmailConnectError } from "@/lib/gmail/oauth";
import { GMAIL_QUOTA_USER_MESSAGE, isGmailQuotaError } from "@/lib/gmail/retry";
import { createGmailScanPort } from "@/lib/scans/gmail-port";
import {
  DEFAULT_LOOKBACK_DAYS,
  INITIAL_LOOKBACK_DAYS,
  type InitialLookbackDays,
} from "@/lib/scans/lookback";
import { isMissingScanSchemaError, SCAN_IN_PROGRESS, SCAN_SCHEMA_MISSING_MESSAGE } from "@/lib/scans/errors";
import { openGmailScan, executeGmailScan } from "@/lib/scans/process-scan";
import { createSupabaseScanStore } from "@/lib/scans/store";
import { persistDigestAfterScan } from "@/lib/digest/build-digest";
import { createAdminClient } from "@/lib/supabase/admin";
import type { ScanRunResult } from "@/lib/scans/types";

export const manualScanRequestSchema = z.object({
  lookbackDays: z
    .number()
    .int()
    .refine((value): value is InitialLookbackDays =>
      (INITIAL_LOOKBACK_DAYS as readonly number[]).includes(value),
    )
    .default(DEFAULT_LOOKBACK_DAYS),
});

const SCAN_RUN_SELECT =
  "id, status, trigger_type, window_start, window_end, started_at, finished_at, messages_discovered, messages_processed, threads_analyzed, threads_discovered, threads_checked, important_count, action_count, reply_count, waiting_count, informational_count, ignored_count, error_code, error_message";

export const MANUAL_SCAN_RATE_LIMIT_MS = 2 * 60_000;

export function isManualScanRateLimited(
  lastAttemptedScanAt: string | null | undefined,
  nowMs = Date.now(),
): boolean {
  const lastAttempt = lastAttemptedScanAt ? Date.parse(lastAttemptedScanAt) : NaN;
  return Number.isFinite(lastAttempt) && nowMs - lastAttempt < MANUAL_SCAN_RATE_LIMIT_MS;
}

export class ScanRequestError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "ScanRequestError";
  }
}

export async function beginManualInitialScan(
  userId: string,
  lookbackDays: InitialLookbackDays = DEFAULT_LOOKBACK_DAYS,
): Promise<{ scanId: string; execute: () => Promise<ScanRunResult> }> {
  if (!isGmailConfigured()) {
    throw new ScanRequestError(503, "gmail_not_configured", "Gmail OAuth is not configured.");
  }
  if (!isGeminiConfigured()) {
    throw new ScanRequestError(503, "gemini_not_configured", "Gemini is not configured.");
  }

  const store = createSupabaseScanStore();
  let connection: { gmail: Awaited<ReturnType<typeof createGmailApiForUser>>["gmail"]; connectionId: string; gmailEmail: string };
  try {
    connection = await createGmailApiForUser(userId);
  } catch (error) {
    if (error instanceof GmailConnectError) {
      throw new ScanRequestError(409, error.reason, error.message);
    }
    throw error;
  }

  const db = createAdminClient();
  const { data: existing } = await db
    .from("gmail_connections")
    .select("last_attempted_scan_at, last_successful_scan_at")
    .eq("id", connection.connectionId)
    .maybeSingle();
  if (
    isManualScanRateLimited(
      typeof existing?.last_attempted_scan_at === "string" ? existing.last_attempted_scan_at : null,
    )
  ) {
    throw new ScanRequestError(
      429,
      "rate_limited",
      "A scan was started too recently. Please wait two minutes before scanning again.",
    );
  }

  const triggerType = existing?.last_successful_scan_at ? "MANUAL" : "INITIAL";

  const prepared = await openGmailScan({
    userId,
    connectionId: connection.connectionId,
    gmailEmail: connection.gmailEmail,
    lookbackDays,
    triggerType,
    forceLookback: true,
    gmail: createGmailScanPort(connection.gmail, connection.connectionId),
    store,
    provider: createEmailTriageProvider(),
    modelName: getGeminiEnv().GEMINI_MODEL,
  }).catch(remapScanStartError);

  return {
    scanId: prepared.scanId,
    execute: async () => {
      const result = await executeGmailScan(prepared);
      if (result.status === "SUCCESS" || result.status === "PARTIAL") {
        try {
          await persistDigestAfterScan({ userId, scanId: prepared.scanId });
        } catch (error) {
          console.error("[digest]", {
            scanId: prepared.scanId,
            error: error instanceof Error ? error.message : "digest_failed",
          });
        }
      }
      return result;
    },
  };
}

export async function startManualInitialScan(
  userId: string,
  lookbackDays: InitialLookbackDays = DEFAULT_LOOKBACK_DAYS,
): Promise<ScanRunResult> {
  const job = await beginManualInitialScan(userId, lookbackDays);
  return job.execute();
}

function remapScanStartError(error: unknown): never {
  if (error instanceof Error && error.message === SCAN_IN_PROGRESS) {
    throw new ScanRequestError(409, "scan_in_progress", "A scan is already running for this Gmail account.");
  }
  if (isGmailQuotaError(error)) {
    throw new ScanRequestError(429, "gmail_quota", GMAIL_QUOTA_USER_MESSAGE);
  }
  if (isMissingScanSchemaError(error)) {
    throw new ScanRequestError(503, "scan_schema_missing", SCAN_SCHEMA_MISSING_MESSAGE);
  }
  throw error;
}

export async function getScanRunForUser(userId: string, scanId: string) {
  const db = createAdminClient();
  const { data, error } = await db
    .from("scan_runs")
    .select(SCAN_RUN_SELECT)
    .eq("id", scanId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) {
    throw new Error("Failed to load scan run");
  }
  return data;
}

export async function getScanRunsForUser(userId: string, limit = 10) {
  const db = createAdminClient();
  const { data, error } = await db
    .from("scan_runs")
    .select(SCAN_RUN_SELECT)
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) {
    return [];
  }
  return data ?? [];
}

export async function getLatestScanRunForUser(userId: string) {
  const db = createAdminClient();
  const { data, error } = await db
    .from("scan_runs")
    .select(SCAN_RUN_SELECT)
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) {
    return null;
  }
  return data;
}

export async function getInboxCountsForUser(userId: string) {
  const db = createAdminClient();
  const { data, error } = await db
    .from("email_threads")
    .select("importance, status, requires_action")
    .eq("user_id", userId);
  if (error || !data) {
    return {
      processed: 0,
      important: 0,
      needAction: 0,
      waiting: 0,
      ignored: 0,
      fyi: 0,
    };
  }
  return {
    processed: data.length,
    important: data.filter((row) => row.importance === "high").length,
    needAction: data.filter((row) => row.requires_action === true).length,
    waiting: data.filter((row) => row.status === "waiting").length,
    ignored: data.filter((row) => row.status === "ignore").length,
    fyi: data.filter((row) => row.status === "informational" || row.status === "resolved").length,
  };
}
