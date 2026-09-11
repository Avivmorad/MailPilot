import { isNonTaskNotice } from "@/lib/ai/notices";
import { compareOpenActions } from "@/lib/actions/sort";
import type { ActionStatus } from "@/lib/actions/reconcile-action";
import { gmailThreadUrl } from "@/lib/gmail/deep-link";
import { createAdminClient } from "@/lib/supabase/admin";

export interface ActionListItem {
  id: string;
  threadId: string;
  status: ActionStatus;
  title: string;
  description: string | null;
  actionSummary: string | null;
  actionReason: string | null;
  waitingFor: string | null;
  deadline: string | null;
  urgency: string | null;
  latestMessageAt: string | null;
  importance: string | null;
  summary: string | null;
  sender: string | null;
  gmailUrl: string;
  category: string | null;
  actionType: string | null;
}

interface ThreadJoin {
  id: string;
  summary: string | null;
  importance: string | null;
  latest_message_at: string | null;
  gmail_thread_id: string;
  participants: unknown;
  category: string | null;
  short_display_title: string | null;
  action_summary: string | null;
  action_reason: string | null;
}

function senderFromParticipants(participants: unknown): string | null {
  if (!Array.isArray(participants) || participants.length === 0) {
    return null;
  }
  const first = participants[0] as { email?: string; name?: string | null };
  return first.name || first.email || null;
}

export function mapActionListItem(
  row: Record<string, unknown>,
  gmailEmail: string,
): ActionListItem {
  const thread = row.email_threads as ThreadJoin | ThreadJoin[] | null;
  const joined = Array.isArray(thread) ? thread[0] : thread;
  const gmailThreadId = joined?.gmail_thread_id ?? "";
  const description = (row.description as string | null) ?? null;
  const actionSummary = joined?.action_summary ?? description;
  const shortTitle = joined?.short_display_title?.trim() || null;
  return {
    id: String(row.id),
    threadId: String(row.thread_id),
    status: row.status as ActionStatus,
    title: shortTitle || String(row.title),
    description,
    actionSummary,
    actionReason: joined?.action_reason ?? null,
    waitingFor: (row.waiting_for as string | null) ?? null,
    deadline: (row.deadline as string | null) ?? null,
    urgency: (row.urgency as string | null) ?? null,
    latestMessageAt: joined?.latest_message_at ?? null,
    importance: joined?.importance ?? null,
    summary: joined?.summary ?? null,
    sender: senderFromParticipants(joined?.participants),
    gmailUrl: gmailThreadUrl(gmailEmail, gmailThreadId),
    category: joined?.category ?? null,
    actionType: (row.action_type as string | null) ?? null,
  };
}

async function gmailEmailForUser(userId: string): Promise<string> {
  const db = createAdminClient();
  const { data } = await db
    .from("gmail_connections")
    .select("gmail_email")
    .eq("user_id", userId)
    .eq("status", "CONNECTED")
    .limit(1)
    .maybeSingle();
  return typeof data?.gmail_email === "string" ? data.gmail_email : "";
}

export async function listActionsForUser(
  userId: string,
  status: ActionStatus,
  limit = 50,
): Promise<ActionListItem[]> {
  const db = createAdminClient();
  const gmailEmail = await gmailEmailForUser(userId);
  const { data, error } = await db
    .from("action_items")
    .select(
      "id, thread_id, status, title, description, waiting_for, deadline, urgency, snoozed_until, action_type, email_threads ( id, summary, importance, latest_message_at, gmail_thread_id, participants, category, short_display_title, action_summary, action_reason )",
    )
    .eq("user_id", userId)
    .eq("status", status)
    .limit(200);
  if (error || !data) {
    return [];
  }
  const mapped = data.map((row) => mapActionListItem(row as Record<string, unknown>, gmailEmail));
  const visible =
    status === "OPEN"
      ? mapped.filter(
          (item) => !isNonTaskNotice([item.title, item.description, item.summary]),
        )
      : mapped;
  if (status === "OPEN") {
    visible.sort(compareOpenActions);
  } else {
    visible.sort((a, b) => {
      const aTime = a.latestMessageAt ?? "";
      const bTime = b.latestMessageAt ?? "";
      return aTime > bTime ? -1 : aTime < bTime ? 1 : 0;
    });
  }
  return visible.slice(0, limit);
}

export async function countActionsForUser(userId: string, status: ActionStatus): Promise<number> {
  const items = await listActionsForUser(userId, status, 200);
  return items.length;
}
