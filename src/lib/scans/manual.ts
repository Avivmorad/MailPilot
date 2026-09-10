import { z } from "zod";

import { createEmailTriageProvider } from "@/lib/ai/client";
import { getGeminiEnv, isGeminiConfigured, isGmailConfigured } from "@/lib/config/env";
import { createGmailApiForUser } from "@/lib/gmail/client";
import { GmailConnectError } from "@/lib/gmail/oauth";
import { createGmailScanPort } from "@/lib/scans/gmail-port";
import {
  DEFAULT_LOOKBACK_DAYS,
  INITIAL_LOOKBACK_DAYS,
  type InitialLookbackDays,
} from "@/lib/scans/lookback";
import { isMissingScanSchemaError, SCAN_SCHEMA_MISSING_MESSAGE } from "@/lib/scans/errors";
import { processInitialScan } from "@/lib/scans/process-scan";
import { createSupabaseScanStore } from "@/lib/scans/store";
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

const RATE_LIMIT_MS = 15_000;

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

export async function startManualInitialScan(
  userId: string,
  lookbackDays: InitialLookbackDays = DEFAULT_LOOKBACK_DAYS,
): Promise<ScanRunResult> {
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
  const lastAttempt = existing?.last_attempted_scan_at
    ? Date.parse(existing.last_attempted_scan_at as string)
    : NaN;
  if (Number.isFinite(lastAttempt) && Date.now() - lastAttempt < RATE_LIMIT_MS) {
    throw new ScanRequestError(429, "rate_limited", "A scan was started too recently. Please wait a few seconds.");
  }

  const triggerType = existing?.last_successful_scan_at ? "MANUAL" : "INITIAL";

  try {
    return await processInitialScan({
      userId,
      connectionId: connection.connectionId,
      gmailEmail: connection.gmailEmail,
      lookbackDays,
      triggerType,
      gmail: createGmailScanPort(connection.gmail, connection.connectionId),
      store,
      provider: createEmailTriageProvider(),
      modelName: getGeminiEnv().GEMINI_MODEL,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "SCAN_IN_PROGRESS") {
      throw new ScanRequestError(409, "scan_in_progress", "A scan is already running for this Gmail account.");
    }
    if (isMissingScanSchemaError(error)) {
      throw new ScanRequestError(503, "scan_schema_missing", SCAN_SCHEMA_MISSING_MESSAGE);
    }
    throw error;
  }
}

export async function getScanRunForUser(userId: string, scanId: string) {
  const db = createAdminClient();
  const { data, error } = await db
    .from("scan_runs")
    .select(
      "id, status, trigger_type, window_start, window_end, started_at, finished_at, messages_discovered, messages_processed, threads_analyzed, important_count, action_count, reply_count, waiting_count, informational_count, ignored_count, error_code",
    )
    .eq("id", scanId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) {
    throw new Error("Failed to load scan run");
  }
  return data;
}

export async function getLatestScanRunForUser(userId: string) {
  const db = createAdminClient();
  const { data, error } = await db
    .from("scan_runs")
    .select(
      "id, status, trigger_type, window_start, window_end, started_at, finished_at, messages_discovered, messages_processed, threads_analyzed, important_count, action_count, reply_count, waiting_count, informational_count, ignored_count, error_code",
    )
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
    };
  }
  return {
    processed: data.length,
    important: data.filter((row) => row.importance === "high").length,
    needAction: data.filter((row) => row.requires_action === true).length,
    waiting: data.filter((row) => row.status === "waiting").length,
  };
}
