import type { ThreadAnalysis } from "@/lib/ai/schemas";
import type { MessageDirection } from "@/lib/gmail/addresses";

export const ACTION_STATUSES = ["OPEN", "WAITING", "COMPLETED", "SNOOZED"] as const;
export type ActionStatus = (typeof ACTION_STATUSES)[number];

export interface ActionRecord {
  status: ActionStatus;
  title: string;
  description: string | null;
  actionType: string | null;
  waitingFor: string | null;
  deadline: string | null;
  urgency: string | null;
  source: string;
  manualOverride: boolean;
  completedAt: string | null;
}

function titleFor(analysis: ThreadAnalysis): string {
  return analysis.action_summary ?? analysis.short_display_title;
}

function fromAnalysis(
  analysis: ThreadAnalysis,
  status: ActionStatus,
  extras: Partial<ActionRecord> = {},
): ActionRecord {
  return {
    status,
    title: titleFor(analysis),
    description: analysis.action_reason ?? analysis.summary,
    actionType: analysis.action_type === "none" ? null : analysis.action_type,
    waitingFor: analysis.waiting_for,
    deadline: analysis.deadline,
    urgency: analysis.urgency,
    source: "AI",
    manualOverride: false,
    completedAt: null,
    ...extras,
  };
}

/**
 * Deterministic action-item state from the latest analysis (spec §24).
 * Returns null when no action row should exist.
 */
export function reconcileActionItem(input: {
  analysis: ThreadAnalysis;
  existing: ActionRecord | null;
  latestDirection: MessageDirection | null;
  latestMessageAt: string | null;
}): ActionRecord | null {
  const { analysis, existing, latestDirection, latestMessageAt } = input;

  if (
    existing?.manualOverride &&
    existing.status === "COMPLETED" &&
    existing.completedAt &&
    latestMessageAt &&
    latestMessageAt <= existing.completedAt
  ) {
    return existing;
  }

  if (analysis.status === "resolved") {
    if (!existing) {
      return null;
    }
    if (existing.manualOverride && existing.status === "COMPLETED") {
      return existing;
    }
    return {
      ...existing,
      status: "COMPLETED",
      completedAt: existing.completedAt ?? latestMessageAt,
      waitingFor: null,
    };
  }

  if (analysis.status === "waiting") {
    return fromAnalysis(analysis, "WAITING", {
      waitingFor: analysis.waiting_for,
      source: existing?.source ?? "AI",
      manualOverride: false,
    });
  }

  if (analysis.status === "action_required" || analysis.requires_action) {
    if (
      existing?.status === "WAITING" &&
      latestDirection === "INBOUND" &&
      analysis.requires_action
    ) {
      return fromAnalysis(analysis, "OPEN");
    }
    return fromAnalysis(analysis, "OPEN", {
      source: existing?.source ?? "AI",
    });
  }

  if (existing && (analysis.status === "informational" || analysis.status === "ignore")) {
    return {
      ...existing,
      status: existing.manualOverride ? existing.status : existing.status === "COMPLETED" ? "COMPLETED" : existing.status,
    };
  }

  return existing;
}
