import { isDeadlineOverdue } from "@/lib/ui/format";

export const STALE_WAITING_MS = 7 * 24 * 60 * 60 * 1000;

export interface ActionChangeRow {
  status: string;
  createdAt: string;
  updatedAt: string;
  deadline: string | null;
}

export interface DashboardChangeSummary {
  since: string | null;
  newOpen: number;
  completed: number;
  reopened: number;
  staleWaiting: number;
  overdueOpen: number;
}

export function summarizeDashboardChanges(
  rows: ActionChangeRow[],
  since: string | null,
  now: Date = new Date(),
): DashboardChangeSummary {
  const sinceMs = since ? Date.parse(since) : Number.NaN;
  const hasSince = Number.isFinite(sinceMs);
  const staleBefore = now.getTime() - STALE_WAITING_MS;

  let newOpen = 0;
  let completed = 0;
  let reopened = 0;
  let staleWaiting = 0;
  let overdueOpen = 0;

  for (const row of rows) {
    const created = Date.parse(row.createdAt);
    const updated = Date.parse(row.updatedAt);
    if (row.status === "OPEN" && isDeadlineOverdue(row.deadline, now)) {
      overdueOpen += 1;
    }
    if (row.status === "WAITING" && Number.isFinite(updated) && updated < staleBefore) {
      staleWaiting += 1;
    }
    if (!hasSince) {
      continue;
    }
    if (row.status === "OPEN" && Number.isFinite(created) && created >= sinceMs) {
      newOpen += 1;
      continue;
    }
    if (row.status === "OPEN" && Number.isFinite(updated) && updated >= sinceMs && created < sinceMs) {
      reopened += 1;
      continue;
    }
    if (row.status === "COMPLETED" && Number.isFinite(updated) && updated >= sinceMs) {
      completed += 1;
    }
  }

  return { since, newOpen, completed, reopened, staleWaiting, overdueOpen };
}

function countPhrase(count: number, singular: string, plural: string): string | null {
  if (count <= 0) {
    return null;
  }
  return `${count} ${count === 1 ? singular : plural}`;
}

export function formatDashboardChangeLine(summary: DashboardChangeSummary): string | null {
  const scanBits = [
    countPhrase(summary.newOpen, "new open task", "new open tasks"),
    countPhrase(summary.completed, "completed", "completed"),
    countPhrase(summary.reopened, "reopened", "reopened"),
  ].filter((value): value is string => Boolean(value));

  const extraBits = [
    countPhrase(summary.overdueOpen, "overdue open task", "overdue open tasks"),
    countPhrase(summary.staleWaiting, "stale waiting item", "stale waiting items"),
  ].filter((value): value is string => Boolean(value));

  if (scanBits.length === 0 && extraBits.length === 0) {
    return summary.since ? "No action changes since the last successful scan." : null;
  }
  if (scanBits.length === 0) {
    return extraBits.join(", ") + ".";
  }
  const scan = `Since last scan: ${scanBits.join(", ")}.`;
  if (extraBits.length === 0) {
    return scan;
  }
  return `${scan} ${extraBits.join(", ")}.`;
}
