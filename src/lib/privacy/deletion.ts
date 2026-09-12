import { z } from "zod";

import { disconnectGmailForUser } from "@/lib/gmail/connections";
import {
  DELETE_ACCOUNT_CONFIRMATION,
  DELETE_ANALYSIS_CONFIRMATION,
} from "@/lib/privacy/confirmations";
import { createAdminClient } from "@/lib/supabase/admin";

export {
  DELETE_ACCOUNT_CONFIRMATION,
  DELETE_ANALYSIS_CONFIRMATION,
} from "@/lib/privacy/confirmations";

export const deleteAnalysisRequestSchema = z.object({
  confirmation: z.literal(DELETE_ANALYSIS_CONFIRMATION),
});

export const deleteAccountRequestSchema = z.object({
  confirmation: z.literal(DELETE_ACCOUNT_CONFIRMATION),
});

export type UserScopedTable =
  | "digest_reports"
  | "scan_runs"
  | "classification_feedback"
  | "action_items"
  | "email_messages"
  | "email_threads";

export interface AnalysisDeletionPort {
  connectionIdsForUser(userId: string): Promise<string[]>;
  deleteWhereUser(table: UserScopedTable, userId: string): Promise<number>;
  deleteScanJobsForConnections(connectionIds: string[]): Promise<number>;
  resetConnectionScanState(userId: string): Promise<void>;
}

export interface AccountDeletionPort extends AnalysisDeletionPort {
  disconnectGmail(userId: string): Promise<void>;
  deleteAuthUser(userId: string): Promise<void>;
}

export async function deleteAnalysisDataForUser(
  userId: string,
  port: AnalysisDeletionPort,
): Promise<Record<string, number>> {
  const deleted: Record<string, number> = {};
  const connectionIds = await port.connectionIdsForUser(userId);
  deleted.digest_reports = await port.deleteWhereUser("digest_reports", userId);
  deleted.scan_jobs = await port.deleteScanJobsForConnections(connectionIds);
  deleted.scan_runs = await port.deleteWhereUser("scan_runs", userId);
  deleted.classification_feedback = await port.deleteWhereUser("classification_feedback", userId);
  deleted.action_items = await port.deleteWhereUser("action_items", userId);
  deleted.email_messages = await port.deleteWhereUser("email_messages", userId);
  deleted.email_threads = await port.deleteWhereUser("email_threads", userId);
  await port.resetConnectionScanState(userId);
  return deleted;
}

export async function deleteAccountForUser(
  userId: string,
  port: AccountDeletionPort,
): Promise<void> {
  await deleteAnalysisDataForUser(userId, port);
  await port.disconnectGmail(userId);
  await port.deleteAuthUser(userId);
}

export function createSupabaseDeletionPort(): AccountDeletionPort {
  const db = createAdminClient();

  return {
    async connectionIdsForUser(userId) {
      const { data, error } = await db.from("gmail_connections").select("id").eq("user_id", userId);
      if (error) {
        throw new Error("Failed to load Gmail connections for deletion");
      }
      return (data ?? []).map((row) => row.id as string);
    },

    async deleteWhereUser(table, userId) {
      const { error, count } = await db
        .from(table)
        .delete({ count: "exact" })
        .eq("user_id", userId);
      if (error) {
        throw new Error(`Failed to delete ${table}`);
      }
      return count ?? 0;
    },

    async deleteScanJobsForConnections(connectionIds) {
      if (connectionIds.length === 0) {
        return 0;
      }
      const { error, count } = await db
        .from("scan_jobs")
        .delete({ count: "exact" })
        .in("gmail_connection_id", connectionIds);
      if (error) {
        throw new Error("Failed to delete scan jobs");
      }
      return count ?? 0;
    },

    async resetConnectionScanState(userId) {
      const { error } = await db
        .from("gmail_connections")
        .update({
          gmail_history_id: null,
          last_successful_scan_at: null,
        })
        .eq("user_id", userId);
      if (error) {
        throw new Error("Failed to reset Gmail scan checkpoints");
      }
    },

    async disconnectGmail(userId) {
      await disconnectGmailForUser(userId);
    },

    async deleteAuthUser(userId) {
      const { error } = await db.auth.admin.deleteUser(userId);
      if (error) {
        throw new Error("Failed to delete GmailPilot account");
      }
    },
  };
}
