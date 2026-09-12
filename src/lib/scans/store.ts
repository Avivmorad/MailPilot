import { normalizeCategory } from "@/lib/ai/categories";
import { threadAnalysisSchema, type ThreadAnalysis } from "@/lib/ai/schemas";
import type { ActionRecord } from "@/lib/actions/reconcile-action";
import { parseAddressList, parseEmailAddress } from "@/lib/gmail/addresses";
import { createAdminClient } from "@/lib/supabase/admin";
import { scanStoreFailure, isScanRunUniqueViolation, SCAN_IN_PROGRESS } from "@/lib/scans/errors";
import { timestampOrNull } from "@/lib/scans/timestamps";
import type { ScanSettings, ScanStorePort, StoredThreadRow } from "@/lib/scans/types";

function failStore(operation: string, error: { message?: string } | null): never {
  throw scanStoreFailure(operation, error?.message);
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((item): item is string => typeof item === "string");
}

function analysisFromRow(row: Record<string, unknown>): ThreadAnalysis | null {
  const parsed = threadAnalysisSchema.safeParse({
    summary: row.summary,
    importance: row.importance,
    importance_reason: row.importance_reason,
    status: row.status,
    requires_action: row.requires_action,
    requires_reply: row.requires_reply,
    action_type: row.action_type ?? "none",
    action_summary: row.action_summary,
    action_reason: row.action_reason,
    waiting_for: row.waiting_for,
    waiting_since: row.waiting_since,
    urgency: row.urgency ?? "normal",
    deadline: row.deadline,
    deadline_text: row.deadline_text,
    category: normalizeCategory(typeof row.category === "string" ? row.category : null),
    sender_name: null,
    organization: null,
    confidence: row.confidence ?? 0,
    short_display_title: row.short_display_title ?? row.summary,
  });
  return parsed.success ? parsed.data : null;
}

function actionFromRow(row: Record<string, unknown>): ActionRecord {
  return {
    status: row.status as ActionRecord["status"],
    title: String(row.title),
    description: (row.description as string | null) ?? null,
    actionType: (row.action_type as string | null) ?? null,
    waitingFor: (row.waiting_for as string | null) ?? null,
    deadline: (row.deadline as string | null) ?? null,
    urgency: (row.urgency as string | null) ?? null,
    source: String(row.source ?? "AI"),
    manualOverride: Boolean(row.manual_override),
    completedAt: (row.completed_at as string | null) ?? null,
    snoozedUntil: (row.snoozed_until as string | null) ?? null,
  };
}

export function createSupabaseScanStore(): ScanStorePort {
  const db = createAdminClient();

  return {
    async findRunningScan(connectionId) {
      const { data, error } = await db
        .from("scan_runs")
        .select("id, started_at")
        .eq("gmail_connection_id", connectionId)
        .eq("status", "RUNNING")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) {
        failStore("Failed to load running scan", error);
      }
      if (!data) {
        return null;
      }
      return { id: data.id as string, startedAt: (data.started_at as string | null) ?? null };
    },

    async failScan(scanId, errorCode, errorMessage) {
      const { error } = await db
        .from("scan_runs")
        .update({
          status: "FAILED",
          finished_at: new Date().toISOString(),
          error_code: errorCode,
          error_message: errorMessage,
        })
        .eq("id", scanId);
      if (error) {
        failStore("Failed to mark stale scan as failed", error);
      }
    },

    async insertScanRun(input) {
      const { data, error } = await db
        .from("scan_runs")
        .insert({
          user_id: input.userId,
          gmail_connection_id: input.connectionId,
          trigger_type: input.triggerType,
          status: "RUNNING",
          window_start: input.windowStart,
          window_end: input.windowEnd,
          started_at: new Date().toISOString(),
        })
        .select("id")
        .single();
      if (isScanRunUniqueViolation(error)) {
        throw new Error(SCAN_IN_PROGRESS);
      }
      if (error || !data) {
        failStore("Failed to create scan run", error);
      }
      return data.id as string;
    },

    async updateScanRun(scanId, patch) {
      const row: Record<string, unknown> = { status: patch.status };
      if (patch.finishedAt) row.finished_at = patch.finishedAt;
      if (patch.errorCode !== undefined) row.error_code = patch.errorCode;
      if (patch.errorMessage !== undefined) row.error_message = patch.errorMessage;
      if (patch.messagesDiscovered !== undefined) row.messages_discovered = patch.messagesDiscovered;
      if (patch.messagesProcessed !== undefined) row.messages_processed = patch.messagesProcessed;
      if (patch.threadsAnalyzed !== undefined) row.threads_analyzed = patch.threadsAnalyzed;
      if (patch.threadsDiscovered !== undefined) row.threads_discovered = patch.threadsDiscovered;
      if (patch.threadsChecked !== undefined) row.threads_checked = patch.threadsChecked;
      if (patch.importantCount !== undefined) row.important_count = patch.importantCount;
      if (patch.actionCount !== undefined) row.action_count = patch.actionCount;
      if (patch.replyCount !== undefined) row.reply_count = patch.replyCount;
      if (patch.waitingCount !== undefined) row.waiting_count = patch.waitingCount;
      if (patch.informationalCount !== undefined) row.informational_count = patch.informationalCount;
      if (patch.ignoredCount !== undefined) row.ignored_count = patch.ignoredCount;
      const { error } = await db.from("scan_runs").update(row).eq("id", scanId);
      if (error) {
        failStore("Failed to update scan run", error);
      }
    },

    async getSettings(userId) {
      const { data, error } = await db
        .from("user_triage_settings")
        .upsert(
          {
            user_id: userId,
            initial_lookback_days: 7,
            daily_scan_time: "08:00",
            timezone: "Asia/Jerusalem",
            scan_interval_minutes: null,
          },
          { onConflict: "user_id" },
        )
        .select("vip_senders, ignored_senders, timezone, daily_scan_time")
        .single();
      if (error || !data) {
        failStore("Failed to load triage settings", error);
      }
      const settings: ScanSettings = {
        vipSenders: asStringArray(data.vip_senders),
        ignoredSenders: asStringArray(data.ignored_senders),
        timezone: (data.timezone as string | null) || "Asia/Jerusalem",
        dailyScanTime: (data.daily_scan_time as string | null) ?? "08:00",
      };
      return settings;
    },

    async getConnectionScanState(connectionId) {
      const { data, error } = await db
        .from("gmail_connections")
        .select("gmail_history_id, last_successful_scan_at")
        .eq("id", connectionId)
        .maybeSingle();
      if (error) {
        failStore("Failed to load Gmail connection scan state", error);
      }
      return {
        historyId: (data?.gmail_history_id as string | null) ?? null,
        lastSuccessfulScanAt: (data?.last_successful_scan_at as string | null) ?? null,
      };
    },

    async upsertThread(input) {
      const analysis = input.analysis;
      const { data, error } = await db
        .from("email_threads")
        .upsert(
          {
            user_id: input.userId,
            gmail_connection_id: input.connectionId,
            gmail_thread_id: input.gmailThreadId,
            subject: input.subject,
            participants: input.participants,
            latest_message_at: input.latestMessageAt,
            latest_message_direction: input.latestMessageDirection,
            summary: analysis?.summary ?? null,
            short_display_title: analysis?.short_display_title ?? null,
            importance: analysis?.importance ?? null,
            importance_reason: analysis?.importance_reason ?? null,
            status: analysis?.status ?? "informational",
            requires_action: analysis?.requires_action ?? false,
            requires_reply: analysis?.requires_reply ?? false,
            action_type: analysis?.action_type ?? null,
            action_summary: analysis?.action_summary ?? null,
            action_reason: analysis?.action_reason ?? null,
            waiting_for: analysis?.waiting_for ?? null,
            waiting_since: timestampOrNull(analysis?.waiting_since),
            urgency: analysis?.urgency ?? null,
            deadline: analysis?.deadline ?? null,
            deadline_text: analysis?.deadline_text ?? null,
            category: analysis?.category ?? null,
            confidence: analysis?.confidence ?? null,
            analysis_version: input.promptVersion,
            prompt_version: input.promptVersion,
            model_name: input.modelName,
            last_analyzed_message_id: input.lastAnalyzedMessageId,
            last_analyzed_at: analysis ? new Date().toISOString() : null,
          },
          { onConflict: "gmail_connection_id,gmail_thread_id" },
        )
        .select("id")
        .single();
      if (error || !data) {
        failStore("Failed to upsert email thread", error);
      }
      return data.id as string;
    },

    async getThread(connectionId, gmailThreadId) {
      const { data, error } = await db
        .from("email_threads")
        .select("*")
        .eq("gmail_connection_id", connectionId)
        .eq("gmail_thread_id", gmailThreadId)
        .maybeSingle();
      if (error) {
        failStore("Failed to load email thread", error);
      }
      if (!data) {
        return null;
      }
      const row: StoredThreadRow = {
        id: data.id as string,
        lastAnalyzedMessageId: (data.last_analyzed_message_id as string | null) ?? null,
        promptVersion: (data.prompt_version as string | null) ?? null,
        analysis: analysisFromRow(data as Record<string, unknown>),
      };
      return row;
    },

    async upsertMessage(input) {
      const from = parseEmailAddress(input.message.from);
      const { error } = await db.from("email_messages").upsert(
        {
          user_id: input.userId,
          gmail_connection_id: input.connectionId,
          thread_id: input.threadId,
          gmail_message_id: input.message.gmailMessageId,
          gmail_thread_id: input.message.gmailThreadId,
          gmail_history_id: input.message.historyId,
          internet_message_id: input.message.messageIdHeader,
          sender_email: from?.email ?? null,
          sender_name: from?.name ?? null,
          to_addresses: parseAddressList(input.message.to),
          cc_addresses: parseAddressList(input.message.cc),
          subject: input.message.subject,
          snippet: input.message.snippet,
          direction: input.direction,
          received_at: input.receivedAt,
          gmail_label_ids: input.message.labelIds,
          has_attachments: input.message.hasAttachments,
          attachments: input.message.attachments,
          content_hash: input.contentHash,
          processed_at: new Date().toISOString(),
        },
        { onConflict: "gmail_connection_id,gmail_message_id" },
      );
      if (error) {
        failStore("Failed to upsert email message", error);
      }
    },

    async getAction(threadId) {
      const { data, error } = await db.from("action_items").select("*").eq("thread_id", threadId).maybeSingle();
      if (error) {
        failStore("Failed to load action item", error);
      }
      if (!data) {
        return null;
      }
      return actionFromRow(data as Record<string, unknown>);
    },

    async upsertAction(userId, threadId, action) {
      const { error } = await db.from("action_items").upsert(
        {
          user_id: userId,
          thread_id: threadId,
          status: action.status,
          title: action.title,
          description: action.description,
          action_type: action.actionType,
          waiting_for: action.waitingFor,
          deadline: action.deadline,
          urgency: action.urgency,
          source: action.source,
          manual_override: action.manualOverride,
          completed_at: action.completedAt,
          snoozed_until: action.snoozedUntil,
        },
        { onConflict: "thread_id" },
      );
      if (error) {
        failStore("Failed to upsert action item", error);
      }
    },

    async updateConnectionScan(input) {
      const patch: Record<string, unknown> = {
        last_attempted_scan_at: input.lastAttemptedScanAt,
        next_scan_at: input.nextScanAt,
      };
      if (input.historyId) {
        patch.gmail_history_id = input.historyId;
      }
      if (input.lastSuccessfulScanAt !== undefined) {
        patch.last_successful_scan_at = input.lastSuccessfulScanAt;
      }
      const { error } = await db.from("gmail_connections").update(patch).eq("id", input.connectionId);
      if (error) {
        failStore("Failed to update Gmail connection scan state", error);
      }
    },
  };
}
