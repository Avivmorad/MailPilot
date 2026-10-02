import { z } from "zod";

import { createEmailTriageProvider } from "@/lib/ai/client";
import { getTriageModelName, isGmailConfigured, isTriageConfigured } from "@/lib/config/env";
import { persistDigestAfterScan } from "@/lib/digest/build-digest";
import { emitProductEvent } from "@/lib/observability/events";
import { captureSafeException } from "@/lib/observability/sentry-report";
import { createGmailApiForConnection } from "@/lib/gmail/client";
import { GmailConnectError } from "@/lib/gmail/oauth";
import { authorizeCronRequest } from "@/lib/scans/cron-auth";
import {
  DISPATCH_CHAIN_ATTEMPTS,
  DISPATCH_CYCLE_MAX_SLICES,
  DISPATCH_DEFAULT_LIMIT,
  DISPATCH_LEASE_SECONDS,
  SCAN_CONTINUE_RETRY_MS,
  SCAN_WORK_BUDGET_MS,
  hasDispatchBudget,
} from "@/lib/scans/dispatch-budget";
import { scanHasRemainingWork } from "@/lib/scans/checkpoint";
import { SCAN_IN_PROGRESS } from "@/lib/scans/errors";
import { createGmailScanPort } from "@/lib/scans/gmail-port";
import {
  acquireScanJob,
  finishScanJob,
  incrementScanJobAttempt,
  markScanJobRunning,
  resolveScanSliceJob,
} from "@/lib/scans/jobs";
import {
  claimDueConnections,
  countDueConnections,
  releaseConnectionLease,
  type ClaimedConnection,
} from "@/lib/scans/leases";
import { DEFAULT_LOOKBACK_DAYS } from "@/lib/scans/lookback";
import { openGmailScan, executeGmailScan, resumeGmailScan } from "@/lib/scans/process-scan";
import {
  SCAN_CONTINUE_TIMEOUT_MS,
  scanAppBaseUrl,
  scheduleScanContinuation,
} from "@/lib/scans/continue";
import { nextScanAfterFailure } from "@/lib/scans/schedule";
import { createSupabaseScanStore } from "@/lib/scans/store";
import { createAdminClient } from "@/lib/supabase/admin";

export { authorizeCronRequest };

export type DispatcherResultStatus = "SUCCESS" | "PARTIAL" | "FAILED" | "SKIPPED" | "CONTINUED";

export interface DispatcherConnectionResult {
  connectionId: string;
  status: DispatcherResultStatus;
  scanId?: string;
  error?: string;
}

async function setNextScanAt(connectionId: string, nextScanAt: string): Promise<void> {
  const db = createAdminClient();
  const { error } = await db
    .from("gmail_connections")
    .update({ next_scan_at: nextScanAt })
    .eq("id", connectionId);
  if (error) {
    throw new Error("Failed to schedule next scan");
  }
}

async function runClaimedConnection(
  claimed: { id: string; userId: string; gmailEmail: string },
  workerId: string,
  now: Date,
): Promise<DispatcherConnectionResult> {
  const requestBudget = { deadlineAt: Date.now() + SCAN_WORK_BUDGET_MS };
  const leaseExpiresAt = new Date(now.getTime() + DISPATCH_LEASE_SECONDS * 1000).toISOString();
  let jobId: string | null = null;
  let attempt = 0;

  try {
    if (!isGmailConfigured() || !isTriageConfigured()) {
      throw new Error("not_configured");
    }

    const api = await createGmailApiForConnection(claimed.id, requestBudget);
    const store = createSupabaseScanStore();
    const running = await store.findRunningScan(claimed.id);
    const checkpoint = running ? await store.getScanCheckpoint(running.id) : null;
    const resumeExisting = checkpoint && scanHasRemainingWork(checkpoint) ? checkpoint : null;

    try {
      jobId = await acquireScanJob({
        connectionId: claimed.id,
        workerId,
        leaseExpiresAt,
        scanId: resumeExisting?.scanId ?? null,
        now,
      });
      attempt = await incrementScanJobAttempt(jobId);
    } catch {
      await setNextScanAt(claimed.id, new Date(now.getTime() + 5 * 60_000).toISOString());
      return { connectionId: claimed.id, status: "SKIPPED", error: "scan_job_in_progress" };
    }

    const prepared = resumeExisting
      ? await resumeGmailScan({
          scanId: resumeExisting.scanId,
          gmailEmail: api.gmailEmail,
          gmail: createGmailScanPort(api.gmail, claimed.id, requestBudget),
          store,
          provider: createEmailTriageProvider(),
          modelName: getTriageModelName(),
          now,
        })
      : await openGmailScan({
          userId: api.userId,
          connectionId: claimed.id,
          gmailEmail: api.gmailEmail,
          lookbackDays: DEFAULT_LOOKBACK_DAYS,
          triggerType: "SCHEDULED",
          gmail: createGmailScanPort(api.gmail, claimed.id, requestBudget),
          store,
          provider: createEmailTriageProvider(),
          modelName: getTriageModelName(),
          now,
        });

    const marked = await markScanJobRunning(jobId, prepared.scanId, workerId);
    if (!marked) {
      throw new Error(SCAN_IN_PROGRESS);
    }
    const result = await executeGmailScan({
      ...prepared,
      jobLease: { jobId, workerId },
    });

    if (result.status === "SUCCESS" || result.status === "PARTIAL") {
      try {
        await persistDigestAfterScan({ userId: api.userId, scanId: prepared.scanId });
      } catch (error) {
        emitProductEvent({ type: "digest.created", scanId: prepared.scanId, persisted: 0 });
        captureSafeException(error, {
          route: "/api/cron/scan-dispatcher",
          scan_type: "scheduled",
        });
      }
    }

    const handoffLease = new Date(Date.now() + DISPATCH_LEASE_SECONDS * 1000).toISOString();
    await resolveScanSliceJob(jobId, result, workerId, handoffLease);

    if (result.status === "CONTINUED") {
      const chained = await scheduleScanContinuation(prepared.scanId);
      if (!chained) {
        await setNextScanAt(
          claimed.id,
          new Date(now.getTime() + SCAN_CONTINUE_RETRY_MS).toISOString(),
        );
      }
      return { connectionId: claimed.id, status: "CONTINUED", scanId: prepared.scanId };
    }

    return { connectionId: claimed.id, status: result.status, scanId: prepared.scanId };
  } catch (error) {
    const message = error instanceof Error ? error.message : "scan_failed";
    if (message === SCAN_IN_PROGRESS) {
      if (jobId) {
        await finishScanJob(jobId, "FAILED", "scan_in_progress", workerId);
      }
      await setNextScanAt(claimed.id, new Date(now.getTime() + 5 * 60_000).toISOString());
      return { connectionId: claimed.id, status: "SKIPPED", error: "scan_in_progress" };
    }

    if (jobId) {
      await finishScanJob(jobId, "FAILED", message, workerId).catch(() => undefined);
    }
    captureSafeException(error, {
      route: "/api/cron/scan-dispatcher",
      scan_type: "scheduled",
    });
    if (attempt < 1) {
      attempt = 1;
    }

    const store = createSupabaseScanStore();
    const settings = await store.getSettings(claimed.userId).catch(() => ({
      dailyScanTime: "08:00",
      timezone: "Asia/Jerusalem",
      vipSenders: [],
      ignoredSenders: [],
      ignoredDomains: [],
      customAiInstructions: "",
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

export async function dispatchDueScans(
  options: {
    now?: Date;
    limit?: number;
    workerId?: string;
    startedAtMs?: number;
    claimDueConnections?: typeof claimDueConnections;
    runClaimedConnection?: (
      claimed: ClaimedConnection,
      workerId: string,
      now: Date,
    ) => Promise<DispatcherConnectionResult>;
  } = {},
): Promise<{ claimed: number; results: DispatcherConnectionResult[] }> {
  const now = options.now ?? new Date();
  const workerId = options.workerId ?? `dispatcher:${crypto.randomUUID()}`;
  const startedAt = options.startedAtMs ?? Date.now();
  const maxClaims = options.limit ?? DISPATCH_DEFAULT_LIMIT;
  const claim = options.claimDueConnections ?? claimDueConnections;
  const run = options.runClaimedConnection ?? runClaimedConnection;
  const results: DispatcherConnectionResult[] = [];

  while (results.length < maxClaims) {
    if (!hasDispatchBudget(startedAt)) {
      break;
    }

    const claimed = await claim({
      workerId,
      limit: 1,
      now,
      leaseSeconds: DISPATCH_LEASE_SECONDS,
    });
    const connection = claimed[0];
    if (!connection) {
      break;
    }

    results.push(await run(connection, workerId, now));
  }

  return { claimed: results.length, results };
}

export const dispatchSliceRequestSchema = z.object({
  slice: z
    .number()
    .int()
    .nonnegative()
    .max(DISPATCH_CYCLE_MAX_SLICES - 1)
    .optional(),
});

export interface DispatchCycleResult {
  slice: number;
  claimed: number;
  results: DispatcherConnectionResult[];
  remainingDue: number | null;
  chained: boolean;
  backlog: boolean;
}

type DispatchCycleOptions = {
  now?: Date;
  slice?: number;
  workerId?: string;
  startedAtMs?: number;
  claimDueConnections?: typeof claimDueConnections;
  runClaimedConnection?: (
    claimed: ClaimedConnection,
    workerId: string,
    now: Date,
  ) => Promise<DispatcherConnectionResult>;
  countDueConnections?: (now: Date) => Promise<number>;
  scheduleNextSlice?: (slice: number) => Promise<boolean>;
};

export async function parseDispatchSlice(
  request: Request,
): Promise<{ ok: true; slice: number } | { ok: false }> {
  if (request.method === "GET") {
    return { ok: true, slice: 0 };
  }
  const text = await request.text();
  if (!text.trim()) {
    return { ok: true, slice: 0 };
  }
  let json: unknown;
  try {
    json = JSON.parse(text) as unknown;
  } catch {
    return { ok: false };
  }
  const parsed = dispatchSliceRequestSchema.safeParse(json);
  if (!parsed.success) {
    return { ok: false };
  }
  return { ok: true, slice: parsed.data.slice ?? 0 };
}

/**
 * Start the next dispatcher slice of this daily cycle. Retries a few times.
 * The next invocation must acknowledge before {@link SCAN_CONTINUE_TIMEOUT_MS}
 * so this call does not wait for that account's scan.
 */
export async function scheduleDispatchSlice(
  slice: number,
  fetchImpl: typeof fetch = fetch,
): Promise<boolean> {
  const base = scanAppBaseUrl();
  const secret = process.env.CRON_SECRET;
  if (!base || !secret || slice < 1 || slice >= DISPATCH_CYCLE_MAX_SLICES) {
    return false;
  }
  const body = JSON.stringify({ slice });
  for (let attempt = 1; attempt <= DISPATCH_CHAIN_ATTEMPTS; attempt += 1) {
    try {
      const response = await fetchImpl(`${base}/api/cron/scan-dispatcher`, {
        method: "POST",
        headers: {
          authorization: `Bearer ${secret}`,
          "content-type": "application/json",
        },
        body,
        signal: AbortSignal.timeout(SCAN_CONTINUE_TIMEOUT_MS),
      });
      if (response.ok) {
        return true;
      }
    } catch {
      // The next attempt is the retry. The body never includes mail or tokens.
    }
  }
  return false;
}

function emitDispatchCycle(result: DispatchCycleResult): void {
  const counts =
    result.remainingDue === null
      ? { slice: result.slice, claimed: result.claimed }
      : { slice: result.slice, claimed: result.claimed, remainingDue: result.remainingDue };
  emitProductEvent({
    type: "scan.dispatch_slice",
    status: result.backlog ? "backlog" : result.chained ? "continued" : "drained",
    ...counts,
    ...(result.backlog ? { errorCode: "dispatch_backlog" } : {}),
  });
  if (!result.backlog) {
    return;
  }
  emitProductEvent({
    type: "scan.dispatch_backlog",
    status: "backlog",
    errorCode: "dispatch_backlog",
    ...counts,
  });
  captureSafeException(new Error("dispatch_backlog"), {
    route: "/api/cron/scan-dispatcher",
    scan_type: "scheduled",
    error_category: "backlog",
  });
}

/**
 * One Hobby invocation claims at most one due connection. If others are still
 * waiting, chain the next slice of this same daily cycle. A queue that cannot
 * be retried raises a backlog alert instead of waiting silently until tomorrow.
 */
export async function runDispatchCycle(
  options: DispatchCycleOptions = {},
): Promise<DispatchCycleResult> {
  const now = options.now ?? new Date();
  const slice = options.slice ?? 0;
  const count = options.countDueConnections ?? countDueConnections;
  const schedule = options.scheduleNextSlice ?? scheduleDispatchSlice;

  if (slice < 0 || slice >= DISPATCH_CYCLE_MAX_SLICES) {
    return backlogWithoutClaim(slice, now, count);
  }

  let summary: { claimed: number; results: DispatcherConnectionResult[] } = {
    claimed: 0,
    results: [],
  };
  try {
    summary = await dispatchDueScans({
      now,
      limit: DISPATCH_DEFAULT_LIMIT,
      workerId: options.workerId,
      startedAtMs: options.startedAtMs,
      claimDueConnections: options.claimDueConnections,
      runClaimedConnection: options.runClaimedConnection,
    });
  } catch (error) {
    captureSafeException(error, {
      route: "/api/cron/scan-dispatcher",
      scan_type: "scheduled",
    });
  }

  return finishCycle(slice, summary, now, count, schedule);
}

async function backlogWithoutClaim(
  slice: number,
  now: Date,
  count: (now: Date) => Promise<number>,
): Promise<DispatchCycleResult> {
  let remainingDue: number | null = null;
  try {
    remainingDue = await count(now);
  } catch (error) {
    captureSafeException(error, {
      route: "/api/cron/scan-dispatcher",
      scan_type: "scheduled",
      error_category: "store",
    });
  }
  const result: DispatchCycleResult = {
    slice,
    claimed: 0,
    results: [],
    remainingDue,
    chained: false,
    backlog: remainingDue !== 0,
  };
  emitDispatchCycle(result);
  return result;
}

async function finishCycle(
  slice: number,
  summary: { claimed: number; results: DispatcherConnectionResult[] },
  now: Date,
  count: (now: Date) => Promise<number>,
  schedule: (slice: number) => Promise<boolean>,
): Promise<DispatchCycleResult> {
  let remainingDue: number | null = null;
  let countFailed = false;
  try {
    remainingDue = await count(now);
  } catch (error) {
    countFailed = true;
    captureSafeException(error, {
      route: "/api/cron/scan-dispatcher",
      scan_type: "scheduled",
      error_category: "store",
    });
  }

  const base = {
    slice,
    claimed: summary.claimed,
    results: summary.results,
    remainingDue,
  };

  if (!countFailed && remainingDue === 0) {
    const drained: DispatchCycleResult = { ...base, chained: false, backlog: false };
    emitDispatchCycle(drained);
    return drained;
  }

  const nextSlice = slice + 1;
  if (nextSlice >= DISPATCH_CYCLE_MAX_SLICES) {
    const backlog: DispatchCycleResult = { ...base, chained: false, backlog: true };
    emitDispatchCycle(backlog);
    return backlog;
  }

  const chained = await schedule(nextSlice);
  const result: DispatchCycleResult = {
    ...base,
    chained,
    backlog: !chained,
  };
  emitDispatchCycle(result);
  return result;
}
