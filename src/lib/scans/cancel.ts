import { z } from "zod";

import { emitProductEvent } from "@/lib/observability/events";
import { cancelActiveJobsForConnection } from "@/lib/scans/jobs";
import { releaseConnectionLease } from "@/lib/scans/leases";
import { SCAN_USER_MESSAGES, scanUserMessage } from "@/lib/scans/errors";
import { ScanRequestError } from "@/lib/scans/manual";
import { createSupabaseScanStore } from "@/lib/scans/store";
import { createAdminClient } from "@/lib/supabase/admin";

export const cancelScanParamsSchema = z.object({
  scanId: z.string().uuid(),
});

export interface ScanCancelPort {
  loadOwnedScan(
    userId: string,
    scanId: string,
  ): Promise<{ id: string; status: string; connectionId: string } | null>;
  failRunningScan(scanId: string, errorCode: string, errorMessage: string): Promise<void>;
  releaseLease(connectionId: string): Promise<void>;
  failActiveJobs(connectionId: string, lastError: string): Promise<void>;
}

export function createSupabaseScanCancelPort(): ScanCancelPort {
  const db = createAdminClient();
  const store = createSupabaseScanStore();
  return {
    async loadOwnedScan(userId, scanId) {
      const { data, error } = await db
        .from("scan_runs")
        .select("id, status, gmail_connection_id")
        .eq("id", scanId)
        .eq("user_id", userId)
        .maybeSingle();
      if (error) {
        throw new Error("Failed to load scan run");
      }
      if (!data) {
        return null;
      }
      return {
        id: data.id as string,
        status: String(data.status),
        connectionId: data.gmail_connection_id as string,
      };
    },
    failRunningScan(scanId, errorCode, errorMessage) {
      return store.failScan(scanId, errorCode, errorMessage);
    },
    releaseLease(connectionId) {
      return releaseConnectionLease(connectionId);
    },
    failActiveJobs(connectionId, lastError) {
      return cancelActiveJobsForConnection(connectionId, lastError);
    },
  };
}

export async function cancelScanForUser(
  userId: string,
  scanId: string,
  port: ScanCancelPort = createSupabaseScanCancelPort(),
): Promise<{ scanId: string; status: "FAILED" }> {
  const scan = await port.loadOwnedScan(userId, scanId);
  if (!scan) {
    throw new ScanRequestError(404, "not_found", "Scan not found.");
  }
  if (scan.status !== "RUNNING") {
    throw new ScanRequestError(409, "not_running", scanUserMessage("not_running"));
  }

  await port.failRunningScan(scan.id, "cancelled", SCAN_USER_MESSAGES.cancelled);
  await port.failActiveJobs(scan.connectionId, "cancelled");
  await port.releaseLease(scan.connectionId).catch(() => undefined);
  emitProductEvent({
    type: "scan.cancelled",
    scanId: scan.id,
    connectionId: scan.connectionId,
    errorCode: "cancelled",
  });
  return { scanId: scan.id, status: "FAILED" };
}
