import { z } from "zod";

import { gmailThreadUrl } from "@/lib/gmail/deep-link";
import { createAdminClient } from "@/lib/supabase/admin";
import { threadFeedbackSchema } from "@/lib/threads/feedback";

export class ThreadQueryError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "ThreadQueryError";
  }
}

export interface ThreadMessageMeta {
  id: string;
  direction: string;
  senderEmail: string | null;
  senderName: string | null;
  subject: string | null;
  snippet: string | null;
  receivedAt: string;
}

export interface ThreadDetail {
  id: string;
  gmailThreadId: string;
  gmailUrl: string;
  subject: string | null;
  summary: string | null;
  shortDisplayTitle: string | null;
  importance: string | null;
  importanceReason: string | null;
  status: string | null;
  requiresAction: boolean;
  requiresReply: boolean;
  actionSummary: string | null;
  actionReason: string | null;
  waitingFor: string | null;
  urgency: string | null;
  deadline: string | null;
  deadlineText: string | null;
  confidence: number | null;
  latestMessageAt: string | null;
  actionId: string | null;
  actionStatus: string | null;
  messages: ThreadMessageMeta[];
}

export interface RecentThreadRow {
  id: string;
  shortDisplayTitle: string | null;
  summary: string | null;
  status: string | null;
  importance: string | null;
  category: string | null;
  latestMessageAt: string | null;
}

type ThreadListDbRow = {
  id: unknown;
  short_display_title: unknown;
  summary: unknown;
  status: unknown;
  importance: unknown;
  category: unknown;
  latest_message_at: unknown;
};

/** FYI / quick updates only — never ignore, open tasks, or waiting. */
export const INBOX_SUMMARY_STATUSES = ["informational", "resolved"] as const;

export function isInboxSummaryStatus(status: string | null | undefined): boolean {
  return status === "informational" || status === "resolved";
}

export function mapRecentThreadRow(row: ThreadListDbRow): RecentThreadRow {
  return {
    id: String(row.id),
    shortDisplayTitle: (row.short_display_title as string | null) ?? null,
    summary: (row.summary as string | null) ?? null,
    status: (row.status as string | null) ?? null,
    importance: (row.importance as string | null) ?? null,
    category: (row.category as string | null) ?? null,
    latestMessageAt: (row.latest_message_at as string | null) ?? null,
  };
}

const THREAD_LIST_SELECT =
  "id, short_display_title, summary, status, importance, category, latest_message_at";

export async function listRecentThreadsForUser(userId: string, limit = 24): Promise<RecentThreadRow[]> {
  const db = createAdminClient();
  const { data, error } = await db
    .from("email_threads")
    .select(THREAD_LIST_SELECT)
    .eq("user_id", userId)
    .in("status", [...INBOX_SUMMARY_STATUSES])
    .order("latest_message_at", { ascending: false })
    .limit(limit);
  if (error || !data) {
    return [];
  }
  return data.map((row) => mapRecentThreadRow(row));
}

export async function listIgnoredThreadsForUser(userId: string, limit = 50): Promise<RecentThreadRow[]> {
  const db = createAdminClient();
  const { data, error } = await db
    .from("email_threads")
    .select(THREAD_LIST_SELECT)
    .eq("user_id", userId)
    .eq("status", "ignore")
    .order("latest_message_at", { ascending: false })
    .limit(limit);
  if (error || !data) {
    return [];
  }
  return data.map((row) => mapRecentThreadRow(row));
}

export async function getThreadDetailForUser(userId: string, threadId: string): Promise<ThreadDetail | null> {
  const db = createAdminClient();
  const { data: thread, error } = await db
    .from("email_threads")
    .select("*")
    .eq("id", threadId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) {
    throw new ThreadQueryError(500, "load_failed", "Failed to load thread.");
  }
  if (!thread) {
    return null;
  }

  const [{ data: messages }, { data: action }, { data: connection }] = await Promise.all([
    db
      .from("email_messages")
      .select("id, direction, sender_email, sender_name, subject, snippet, received_at")
      .eq("thread_id", threadId)
      .eq("user_id", userId)
      .order("received_at", { ascending: true }),
    db.from("action_items").select("id, status").eq("thread_id", threadId).eq("user_id", userId).maybeSingle(),
    db
      .from("gmail_connections")
      .select("gmail_email")
      .eq("id", thread.gmail_connection_id as string)
      .maybeSingle(),
  ]);

  const gmailEmail = typeof connection?.gmail_email === "string" ? connection.gmail_email : "";
  const gmailThreadId = String(thread.gmail_thread_id);

  return {
    id: String(thread.id),
    gmailThreadId,
    gmailUrl: gmailThreadUrl(gmailEmail, gmailThreadId),
    subject: (thread.subject as string | null) ?? null,
    summary: (thread.summary as string | null) ?? null,
    shortDisplayTitle: (thread.short_display_title as string | null) ?? null,
    importance: (thread.importance as string | null) ?? null,
    importanceReason: (thread.importance_reason as string | null) ?? null,
    status: (thread.status as string | null) ?? null,
    requiresAction: Boolean(thread.requires_action),
    requiresReply: Boolean(thread.requires_reply),
    actionSummary: (thread.action_summary as string | null) ?? null,
    actionReason: (thread.action_reason as string | null) ?? null,
    waitingFor: (thread.waiting_for as string | null) ?? null,
    urgency: (thread.urgency as string | null) ?? null,
    deadline: (thread.deadline as string | null) ?? null,
    deadlineText: (thread.deadline_text as string | null) ?? null,
    confidence: thread.confidence == null ? null : Number(thread.confidence),
    latestMessageAt: (thread.latest_message_at as string | null) ?? null,
    actionId: action ? String(action.id) : null,
    actionStatus: action ? String(action.status) : null,
    messages: (messages ?? []).map((message) => ({
      id: String(message.id),
      direction: String(message.direction),
      senderEmail: (message.sender_email as string | null) ?? null,
      senderName: (message.sender_name as string | null) ?? null,
      subject: (message.subject as string | null) ?? null,
      snippet: (message.snippet as string | null) ?? null,
      receivedAt: String(message.received_at),
    })),
  };
}

export async function saveThreadFeedback(
  userId: string,
  threadId: string,
  kind: z.infer<typeof threadFeedbackSchema>["kind"],
) {
  const db = createAdminClient();
  const { data: thread } = await db.from("email_threads").select("id").eq("id", threadId).eq("user_id", userId).maybeSingle();
  if (!thread) {
    throw new ThreadQueryError(404, "not_found", "Thread not found.");
  }
  const { error } = await db.from("classification_feedback").insert({
    user_id: userId,
    thread_id: threadId,
    kind,
  });
  if (error) {
    throw new ThreadQueryError(500, "save_failed", "Failed to save feedback.");
  }
}
