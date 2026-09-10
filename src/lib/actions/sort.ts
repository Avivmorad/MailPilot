import type { ActionStatus } from "@/lib/actions/reconcile-action";

const URGENCY_RANK: Record<string, number> = {
  urgent: 0,
  soon: 1,
  normal: 2,
  none: 3,
};

const IMPORTANCE_RANK: Record<string, number> = {
  high: 0,
  medium: 1,
  low: 2,
};

export interface RankableAction {
  urgency: string | null;
  deadline: string | null;
  importance: string | null;
  latestMessageAt: string | null;
}

export function compareOpenActions(a: RankableAction, b: RankableAction): number {
  const urgency = (URGENCY_RANK[a.urgency ?? "none"] ?? 9) - (URGENCY_RANK[b.urgency ?? "none"] ?? 9);
  if (urgency !== 0) {
    return urgency;
  }
  if (a.deadline && b.deadline && a.deadline !== b.deadline) {
    return a.deadline < b.deadline ? -1 : 1;
  }
  if (a.deadline && !b.deadline) {
    return -1;
  }
  if (!a.deadline && b.deadline) {
    return 1;
  }
  const importance =
    (IMPORTANCE_RANK[a.importance ?? "low"] ?? 9) - (IMPORTANCE_RANK[b.importance ?? "low"] ?? 9);
  if (importance !== 0) {
    return importance;
  }
  const aTime = a.latestMessageAt ?? "";
  const bTime = b.latestMessageAt ?? "";
  if (aTime === bTime) {
    return 0;
  }
  return aTime > bTime ? -1 : 1;
}

export function isActionTab(value: string | null | undefined): value is ActionStatus {
  return value === "OPEN" || value === "WAITING" || value === "COMPLETED" || value === "SNOOZED";
}
