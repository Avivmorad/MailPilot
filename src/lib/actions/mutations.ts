import type { ActionPatch } from "@/lib/actions/patch-schema";
import { nextActionState } from "@/lib/actions/next-state";
import type { ActionRecord, ActionStatus } from "@/lib/actions/reconcile-action";
import { createAdminClient } from "@/lib/supabase/admin";

export class ActionMutationError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "ActionMutationError";
  }
}

function rowToRecord(row: Record<string, unknown>): ActionRecord {
  return {
    status: row.status as ActionStatus,
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

export async function patchActionForUser(
  userId: string,
  actionId: string,
  patch: ActionPatch,
  now: Date = new Date(),
): Promise<ActionRecord> {
  const db = createAdminClient();
  const { data, error } = await db.from("action_items").select("*").eq("id", actionId).eq("user_id", userId).maybeSingle();
  if (error) {
    throw new ActionMutationError(500, "load_failed", "Failed to load action.");
  }
  if (!data) {
    throw new ActionMutationError(404, "not_found", "Action not found.");
  }
  const next = nextActionState(rowToRecord(data as Record<string, unknown>), patch, now);
  const { error: updateError } = await db
    .from("action_items")
    .update({
      status: next.status,
      manual_override: next.manualOverride,
      completed_at: next.completedAt,
      snoozed_until: next.snoozedUntil,
      source: next.source,
    })
    .eq("id", actionId)
    .eq("user_id", userId);
  if (updateError) {
    throw new ActionMutationError(500, "update_failed", "Failed to update action.");
  }
  return next;
}
