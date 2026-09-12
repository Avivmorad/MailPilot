import { createAdminClient } from "@/lib/supabase/admin";

export type ScanJobStatus = "QUEUED" | "RUNNING" | "SUCCESS" | "FAILED";

export interface ScanJobRecord {
  id: string;
  attempt: number;
}

export async function failStaleActiveJobs(
  connectionId: string,
  now: Date = new Date(),
): Promise<void> {
  const db = createAdminClient();
  const { data, error } = await db
    .from("scan_jobs")
    .select("id, lease_expires_at")
    .eq("gmail_connection_id", connectionId)
    .in("status", ["QUEUED", "RUNNING"]);
  if (error) {
    throw new Error("Failed to load active scan jobs");
  }

  const staleIds = (data ?? [])
    .filter((row) => {
      const expires = row.lease_expires_at ? Date.parse(row.lease_expires_at as string) : NaN;
      return !Number.isFinite(expires) || expires <= now.getTime();
    })
    .map((row) => row.id as string);

  if (staleIds.length === 0) {
    return;
  }

  const { error: updateError } = await db
    .from("scan_jobs")
    .update({
      status: "FAILED",
      last_error: "stale_lease",
      locked_at: null,
      locked_by: null,
      lease_expires_at: null,
    })
    .in("id", staleIds);
  if (updateError) {
    throw new Error("Failed to expire stale scan jobs");
  }
}

export async function createScanJob(input: {
  connectionId: string;
  workerId: string;
  leaseExpiresAt: string;
}): Promise<ScanJobRecord> {
  const db = createAdminClient();
  const { data, error } = await db
    .from("scan_jobs")
    .insert({
      gmail_connection_id: input.connectionId,
      status: "QUEUED",
      attempt: 0,
      locked_at: new Date().toISOString(),
      locked_by: input.workerId,
      lease_expires_at: input.leaseExpiresAt,
      available_at: new Date().toISOString(),
    })
    .select("id, attempt")
    .single();

  if (error || !data) {
    throw new Error("Failed to create scan job");
  }
  return { id: data.id as string, attempt: data.attempt as number };
}

export async function markScanJobRunning(jobId: string, scanRunId: string): Promise<void> {
  const db = createAdminClient();
  const { error } = await db
    .from("scan_jobs")
    .update({
      status: "RUNNING",
      scan_run_id: scanRunId,
    })
    .eq("id", jobId);
  if (error) {
    throw new Error("Failed to mark scan job running");
  }
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
): Promise<void> {
  const db = createAdminClient();
  const { error } = await db
    .from("scan_jobs")
    .update({
      status,
      last_error: lastError,
      locked_at: null,
      locked_by: null,
      lease_expires_at: null,
    })
    .eq("id", jobId);
  if (error) {
    throw new Error("Failed to finish scan job");
  }
}
