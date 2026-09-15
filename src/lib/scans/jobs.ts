import { createAdminClient } from "@/lib/supabase/admin";
import type { ScanRunResult } from "@/lib/scans/types";

export type ScanJobStatus = "QUEUED" | "RUNNING" | "SUCCESS" | "FAILED";

export const SCAN_SLICE_IN_PROGRESS = "scan_slice_in_progress";
export const SCAN_SLICE_LEASE_LOST = "scan_slice_lease_lost";

export interface ActiveScanJob {
  id: string;
  scanRunId: string | null;
  status: ScanJobStatus;
  lockedBy: string | null;
  leaseExpiresAt: string | null;
}

export interface ScanJobRecord {
  id: string;
  attempt: number;
}

export interface ScanJobLease {
  jobId: string;
  workerId: string;
}

function isScanJobUniqueViolation(error: { code?: string; message?: string } | null): boolean {
  if (!error) {
    return false;
  }
  if (error.code === "23505") {
    return true;
  }
  return /scan_jobs_one_active_per_connection/i.test(error.message ?? "");
}

function expiredOrUnlockedFilter(nowIso: string): string {
  return `locked_by.is.null,lease_expires_at.is.null,lease_expires_at.lte.${nowIso}`;
}

function staleLeaseFilter(nowIso: string): string {
  return `lease_expires_at.is.null,lease_expires_at.lte.${nowIso}`;
}

export async function failStaleActiveJobs(
  connectionId: string,
  now: Date = new Date(),
): Promise<void> {
  const db = createAdminClient();
  const nowIso = now.toISOString();
  const { error } = await db
    .from("scan_jobs")
    .update({
      status: "FAILED",
      last_error: "stale_lease",
      locked_at: null,
      locked_by: null,
      lease_expires_at: null,
    })
    .eq("gmail_connection_id", connectionId)
    .in("status", ["QUEUED", "RUNNING"])
    .or(staleLeaseFilter(nowIso));
  if (error) {
    throw new Error("Failed to expire stale scan jobs");
  }
}

export async function createScanJob(input: {
  connectionId: string;
  workerId: string;
  leaseExpiresAt: string;
  now?: Date;
}): Promise<ScanJobRecord> {
  const db = createAdminClient();
  const lockedAt = (input.now ?? new Date()).toISOString();
  const { data, error } = await db
    .from("scan_jobs")
    .insert({
      gmail_connection_id: input.connectionId,
      status: "QUEUED",
      attempt: 0,
      locked_at: lockedAt,
      locked_by: input.workerId,
      lease_expires_at: input.leaseExpiresAt,
      available_at: lockedAt,
    })
    .select("id, attempt")
    .single();

  if (isScanJobUniqueViolation(error)) {
    throw new Error(SCAN_SLICE_IN_PROGRESS);
  }
  if (error || !data) {
    throw new Error("Failed to create scan job");
  }
  return { id: data.id as string, attempt: data.attempt as number };
}

export async function findActiveScanJob(connectionId: string): Promise<ActiveScanJob | null> {
  const db = createAdminClient();
  const { data, error } = await db
    .from("scan_jobs")
    .select("id, scan_run_id, status, locked_by, lease_expires_at")
    .eq("gmail_connection_id", connectionId)
    .in("status", ["QUEUED", "RUNNING"])
    .maybeSingle();
  if (error) {
    throw new Error("Failed to load active scan job");
  }
  if (!data) {
    return null;
  }
  return {
    id: data.id as string,
    scanRunId: (data.scan_run_id as string | null) ?? null,
    status: data.status as ScanJobStatus,
    lockedBy: (data.locked_by as string | null) ?? null,
    leaseExpiresAt: (data.lease_expires_at as string | null) ?? null,
  };
}

async function takeOverScanJob(input: {
  jobId: string;
  scanId: string;
  workerId: string;
  leaseExpiresAt: string;
  now: Date;
}): Promise<boolean> {
  const db = createAdminClient();
  const nowIso = input.now.toISOString();
  const { data, error } = await db
    .from("scan_jobs")
    .update({
      status: "RUNNING",
      scan_run_id: input.scanId,
      locked_at: nowIso,
      locked_by: input.workerId,
      lease_expires_at: input.leaseExpiresAt,
    })
    .eq("id", input.jobId)
    .eq("scan_run_id", input.scanId)
    .in("status", ["QUEUED", "RUNNING"])
    .or(expiredOrUnlockedFilter(nowIso))
    .select("id")
    .maybeSingle();
  if (error) {
    throw new Error("Failed to take over scan job");
  }
  return Boolean(data);
}

/**
 * Claim the per-connection scan_jobs mutex. Continuation slices may adopt the
 * existing RUNNING job for the same scan_run_id only when it is unlocked
 * (previous slice handed off) or the lease has expired.
 */
export async function acquireScanJob(input: {
  connectionId: string;
  workerId: string;
  leaseExpiresAt: string;
  scanId?: string | null;
  now?: Date;
}): Promise<string> {
  const now = input.now ?? new Date();
  await failStaleActiveJobs(input.connectionId, now);

  try {
    const job = await createScanJob({
      connectionId: input.connectionId,
      workerId: input.workerId,
      leaseExpiresAt: input.leaseExpiresAt,
      now,
    });
    if (input.scanId) {
      const marked = await markScanJobRunning(job.id, input.scanId, input.workerId);
      if (!marked) {
        throw new Error(SCAN_SLICE_IN_PROGRESS);
      }
    }
    return job.id;
  } catch (error) {
    if (!(error instanceof Error) || error.message !== SCAN_SLICE_IN_PROGRESS) {
      throw error;
    }
    if (!input.scanId) {
      throw new Error(SCAN_SLICE_IN_PROGRESS);
    }
    const active = await findActiveScanJob(input.connectionId);
    if (!active || active.scanRunId !== input.scanId) {
      throw new Error(SCAN_SLICE_IN_PROGRESS);
    }
    const taken = await takeOverScanJob({
      jobId: active.id,
      scanId: input.scanId,
      workerId: input.workerId,
      leaseExpiresAt: input.leaseExpiresAt,
      now,
    });
    if (!taken) {
      throw new Error(SCAN_SLICE_IN_PROGRESS);
    }
    return active.id;
  }
}

/**
 * Ensures only one scan slice runs per Gmail connection. Continuation slices
 * adopt the existing RUNNING job for the same scan_run_id after handoff or
 * lease expiry.
 */
export async function admitScanSlice(input: {
  connectionId: string;
  scanId: string;
  workerId: string;
  leaseExpiresAt: string;
  now?: Date;
}): Promise<string> {
  return acquireScanJob(input);
}

export async function resolveScanSliceJob(
  jobId: string,
  result: Pick<ScanRunResult, "status">,
  workerId: string,
  leaseExpiresAt: string,
): Promise<void> {
  if (result.status === "CONTINUED") {
    await handoffScanJob(jobId, workerId, leaseExpiresAt);
    return;
  }
  if (result.status === "FAILED") {
    await finishScanJob(jobId, "FAILED", null, workerId);
    return;
  }
  await finishScanJob(jobId, "SUCCESS", null, workerId);
}

async function handoffScanJob(
  jobId: string,
  workerId: string,
  leaseExpiresAt: string,
): Promise<boolean> {
  const db = createAdminClient();
  const { data, error } = await db
    .from("scan_jobs")
    .update({
      locked_at: null,
      locked_by: null,
      lease_expires_at: leaseExpiresAt,
    })
    .eq("id", jobId)
    .eq("locked_by", workerId)
    .in("status", ["QUEUED", "RUNNING"])
    .select("id")
    .maybeSingle();
  if (error) {
    throw new Error("Failed to hand off scan job");
  }
  return Boolean(data);
}

export async function markScanJobRunning(
  jobId: string,
  scanRunId: string,
  workerId: string,
): Promise<boolean> {
  const db = createAdminClient();
  const { data, error } = await db
    .from("scan_jobs")
    .update({
      status: "RUNNING",
      scan_run_id: scanRunId,
    })
    .eq("id", jobId)
    .eq("locked_by", workerId)
    .in("status", ["QUEUED", "RUNNING"])
    .select("id")
    .maybeSingle();
  if (error) {
    throw new Error("Failed to mark scan job running");
  }
  return Boolean(data);
}

export async function stillHoldsScanJob(
  jobId: string,
  workerId: string,
  now: Date = new Date(),
): Promise<boolean> {
  const db = createAdminClient();
  const { data, error } = await db
    .from("scan_jobs")
    .select("id, lease_expires_at")
    .eq("id", jobId)
    .eq("locked_by", workerId)
    .in("status", ["QUEUED", "RUNNING"])
    .maybeSingle();
  if (error) {
    throw new Error("Failed to load scan job lease");
  }
  if (!data) {
    return false;
  }
  const expires = data.lease_expires_at ? Date.parse(data.lease_expires_at as string) : NaN;
  return Number.isFinite(expires) && expires > now.getTime();
}

export async function incrementScanJobAttempt(jobId: string): Promise<number> {
  const db = createAdminClient();
  const { data, error } = await db.from("scan_jobs").select("attempt").eq("id", jobId).single();
  if (error || !data) {
    throw new Error("Failed to load scan job attempt");
  }
  const next = (data.attempt as number) + 1;
  const { error: updateError } = await db
    .from("scan_jobs")
    .update({ attempt: next })
    .eq("id", jobId);
  if (updateError) {
    throw new Error("Failed to increment scan job attempt");
  }
  return next;
}

export async function cancelActiveJobsForConnection(
  connectionId: string,
  lastError: string,
): Promise<void> {
  const db = createAdminClient();
  const { error } = await db
    .from("scan_jobs")
    .update({
      status: "FAILED",
      last_error: lastError,
      locked_at: null,
      locked_by: null,
      lease_expires_at: null,
    })
    .eq("gmail_connection_id", connectionId)
    .in("status", ["QUEUED", "RUNNING"]);
  if (error) {
    throw new Error("Failed to cancel active scan jobs");
  }
}

export async function finishScanJob(
  jobId: string,
  status: "SUCCESS" | "FAILED",
  lastError: string | null,
  workerId: string,
): Promise<boolean> {
  const db = createAdminClient();
  const { data, error } = await db
    .from("scan_jobs")
    .update({
      status,
      last_error: lastError,
      locked_at: null,
      locked_by: null,
      lease_expires_at: null,
    })
    .eq("id", jobId)
    .eq("locked_by", workerId)
    .select("id")
    .maybeSingle();
  if (error) {
    throw new Error("Failed to finish scan job");
  }
  return Boolean(data);
}
