import { listActionsForUser } from "@/lib/actions/queries";
import {
  getDigestSettingsForUser,
  getLatestDigestForUser,
  loadDigestPeriodActivity,
  loadScanRunPeriod,
  upsertDigestReport,
} from "@/lib/digest/queries";
import {
  TOP_ACTIONS_LIMIT,
  type DigestMessageActivity,
  type DigestPeriodCounts,
  type DigestReport,
  type DigestThreadActivity,
  type DigestTopAction,
} from "@/lib/digest/types";
import { emitProductEvent } from "@/lib/observability/events";

export {
  digestListQuerySchema,
  digestTopActionSchema,
  TOP_ACTIONS_LIMIT,
} from "@/lib/digest/types";
export type {
  DigestMessageActivity,
  DigestPeriodCounts,
  DigestReport,
  DigestThreadActivity,
  DigestTopAction,
} from "@/lib/digest/types";

export function uniqueTopActions(
  actions: DigestTopAction[],
  limit = TOP_ACTIONS_LIMIT,
): DigestTopAction[] {
  const seen = new Set<string>();
  const unique: DigestTopAction[] = [];
  for (const action of actions) {
    if (seen.has(action.threadId)) {
      continue;
    }
    seen.add(action.threadId);
    unique.push(action);
    if (unique.length >= limit) {
      break;
    }
  }
  return unique;
}

export function computeDigestPeriodCounts(
  messages: DigestMessageActivity[],
  threads: DigestThreadActivity[],
): DigestPeriodCounts {
  const threadById = new Map(threads.map((thread) => [thread.id, thread]));
  const messageIds = new Set<string>();
  const activeThreadIds = new Set<string>();
  let importantCount = 0;

  for (const message of messages) {
    if (messageIds.has(message.id)) {
      continue;
    }
    messageIds.add(message.id);
    activeThreadIds.add(message.threadId);
    const thread = threadById.get(message.threadId);
    if (thread?.importance === "high") {
      importantCount += 1;
    }
  }

  let actionCount = 0;
  let replyCount = 0;
  let waitingCount = 0;
  let informationalCount = 0;
  let ignoredCount = 0;

  for (const threadId of activeThreadIds) {
    const thread = threadById.get(threadId);
    if (!thread) {
      continue;
    }
    if (thread.requiresAction || thread.status === "action_required") {
      actionCount += 1;
    }
    if (thread.requiresReply) {
      replyCount += 1;
    }
    if (thread.status === "waiting") {
      waitingCount += 1;
    }
    if (thread.status === "informational") {
      informationalCount += 1;
    }
    if (thread.status === "ignore") {
      ignoredCount += 1;
    }
  }

  return {
    totalMessages: messageIds.size,
    importantCount,
    actionCount,
    replyCount,
    waitingCount,
    informationalCount,
    ignoredCount,
  };
}

export function buildDigestSummaryText(counts: DigestPeriodCounts): string {
  if (counts.totalMessages === 0) {
    return "No mail was processed in this period.";
  }
  const emails = counts.totalMessages === 1 ? "email" : "emails";
  return [
    `Processed ${counts.totalMessages} ${emails} in this period.`,
    `${counts.actionCount} thread${counts.actionCount === 1 ? " needs" : "s need"} action,`,
    `${counts.waitingCount} waiting,`,
    `${counts.informationalCount} FYI,`,
    `and ${counts.ignoredCount} ignored.`,
    `${counts.importantCount} ${counts.importantCount === 1 ? "was" : "were"} marked important.`,
  ].join(" ");
}

export function sameUtcInstant(left: string, right: string): boolean {
  const a = Date.parse(left);
  const b = Date.parse(right);
  return Number.isFinite(a) && Number.isFinite(b) && a === b;
}

export async function ensureDigestForLatestScan(
  userId: string,
  scanId: string | null,
  scanStatus: string | null,
): Promise<DigestReport | null> {
  const existing = await getLatestDigestForUser(userId);
  if (!scanId || (scanStatus !== "SUCCESS" && scanStatus !== "PARTIAL")) {
    return existing;
  }
  const scan = await loadScanRunPeriod(userId, scanId);
  if (
    existing &&
    scan &&
    sameUtcInstant(existing.periodStart, scan.periodStart) &&
    sameUtcInstant(existing.periodEnd, scan.periodEnd)
  ) {
    return existing;
  }
  try {
    return (await persistDigestAfterScan({ userId, scanId })) ?? existing;
  } catch {
    return existing;
  }
}

export async function persistDigestAfterScan(input: {
  userId: string;
  scanId: string;
}): Promise<DigestReport | null> {
  const settings = await getDigestSettingsForUser(input.userId);
  if (!settings.digestEnabled) {
    return null;
  }

  const scan = await loadScanRunPeriod(input.userId, input.scanId);
  if (!scan) {
    return null;
  }

  const activity = await loadDigestPeriodActivity({
    userId: input.userId,
    connectionId: scan.connectionId,
    periodStart: scan.periodStart,
    periodEnd: scan.periodEnd,
  });
  const counts = computeDigestPeriodCounts(activity.messages, activity.threads);
  const openActions = await listActionsForUser(input.userId, "OPEN", TOP_ACTIONS_LIMIT * 2);
  const topActions = uniqueTopActions(
    openActions.map((item) => ({
      threadId: item.threadId,
      title: item.title,
      urgency: item.urgency,
      deadline: item.deadline,
      category: item.category,
    })),
  );

  const report = await upsertDigestReport({
    userId: input.userId,
    connectionId: scan.connectionId,
    periodStart: scan.periodStart,
    periodEnd: scan.periodEnd,
    counts,
    summaryText: buildDigestSummaryText(counts),
    topActions,
  });
  emitProductEvent({
    type: "digest.created",
    scanId: input.scanId,
    digestId: report.id,
    actionCount: report.actionCount,
    totalMessages: report.totalMessages,
    persisted: 1,
  });
  return report;
}
