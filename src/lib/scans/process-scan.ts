import { tryAnalyzeThread, type EmailTriageProvider } from "@/lib/ai/analyze-thread";
import { TRIAGE_PROMPT_VERSION } from "@/lib/ai/prompts";
import { threadAnalysisSchema, type ThreadAnalysis } from "@/lib/ai/schemas";
import { threadAnalysisInputFromContext } from "@/lib/ai/types";
import { reconcileActionItem } from "@/lib/actions/reconcile-action";
import { getContextLimits } from "@/lib/config/env";
import { classifyDirection, parseAddressList, parseEmailAddress } from "@/lib/gmail/addresses";
import type { MailPilotLogicalLabel } from "@/lib/gmail/constants";
import { labelDiff, logicalLabelsForAnalysis } from "@/lib/gmail/label-plan";
import type { ParsedGmailMessage } from "@/lib/gmail/parser";
import { buildThreadContext } from "@/lib/gmail/thread-context";
import { messageContentHash } from "@/lib/scans/content-hash";
import {
  buildInitialScanQuery,
  DEFAULT_LOOKBACK_DAYS,
  scanWindow,
  type InitialLookbackDays,
} from "@/lib/scans/lookback";
import { mapPool } from "@/lib/scans/pool";
import { nextDailyScanAt } from "@/lib/scans/schedule";
import {
  countersFromAnalyses,
  EMPTY_SCAN_COUNTERS,
  type ScanGmailPort,
  type ScanRunResult,
  type ScanStorePort,
  type StoredThreadRow,
} from "@/lib/scans/types";

const STALE_RUNNING_MS = 20 * 60 * 1000;

function receivedAtIso(internalDate: string | null): string {
  const millis = Number(internalDate);
  if (Number.isFinite(millis) && millis > 0) {
    return new Date(millis).toISOString();
  }
  return new Date().toISOString();
}

function uniqueThreadIds(refs: Array<{ threadId: string }>): string[] {
  return [...new Set(refs.map((ref) => ref.threadId))];
}

function participantsOf(messages: ParsedGmailMessage[]): Array<{ email: string; name: string | null }> {
  const byEmail = new Map<string, { email: string; name: string | null }>();
  for (const message of messages) {
    const addresses = [
      parseEmailAddress(message.from),
      ...parseAddressList(message.to),
      ...parseAddressList(message.cc),
    ];
    for (const address of addresses) {
      if (address) {
        byEmail.set(address.email, address);
      }
    }
  }
  return [...byEmail.values()];
}

function mailpilotIdsOnMessage(
  labelIds: string[],
  labelMap: Map<MailPilotLogicalLabel, string>,
): string[] {
  const ours = new Set(labelMap.values());
  return labelIds.filter((id) => ours.has(id));
}

export function analysisFromStoredThread(row: StoredThreadRow): ThreadAnalysis | null {
  if (!row.analysis) {
    return null;
  }
  const parsed = threadAnalysisSchema.safeParse(row.analysis);
  return parsed.success ? parsed.data : null;
}

export async function processInitialScan(input: {
  userId: string;
  connectionId: string;
  gmailEmail: string;
  lookbackDays?: InitialLookbackDays;
  triggerType?: "INITIAL" | "MANUAL";
  now?: Date;
  gmail: ScanGmailPort;
  store: ScanStorePort;
  analyze?: typeof tryAnalyzeThread;
  provider: EmailTriageProvider;
  modelName: string;
}): Promise<ScanRunResult> {
  const lookbackDays = input.lookbackDays ?? DEFAULT_LOOKBACK_DAYS;
  const now = input.now ?? new Date();
  const triggerType = input.triggerType ?? "INITIAL";
  const analyze = input.analyze ?? tryAnalyzeThread;
  const modelName = input.modelName;
  const provider = input.provider;
  const limits = getContextLimits();
  const { windowStart, windowEnd } = scanWindow(lookbackDays, now);

  const running = await input.store.findRunningScan(input.connectionId);
  if (running?.startedAt) {
    const started = Date.parse(running.startedAt);
    if (Number.isFinite(started) && now.getTime() - started < STALE_RUNNING_MS) {
      throw new Error("SCAN_IN_PROGRESS");
    }
    await input.store.failScan(running.id, "stale_lease", "Previous scan lease expired");
  } else if (running) {
    await input.store.failScan(running.id, "stale_lease", "Previous scan lease expired");
  }

  const scanId = await input.store.insertScanRun({
    userId: input.userId,
    connectionId: input.connectionId,
    triggerType,
    windowStart: windowStart.toISOString(),
    windowEnd: windowEnd.toISOString(),
  });

  const settings = await input.store.getSettings(input.userId);
  const userEmails = [input.gmailEmail];
  const query = buildInitialScanQuery(lookbackDays);

  try {
    const refs = await input.gmail.listMessageRefs(query);
    const threadIds = uniqueThreadIds(refs);
    const labelMap = await input.gmail.loadLabelMap();
    const analyses: ThreadAnalysis[] = [];
    let threadsAnalyzed = 0;
    let threadFailures = 0;
    let messagesProcessed = 0;

    await mapPool(threadIds, limits.AI_MAX_CONCURRENCY, async (gmailThreadId) => {
      try {
        const messages = await input.gmail.fetchThread(gmailThreadId);
        if (messages.length === 0) {
          return;
        }
        const chronological = [...messages].sort(
          (a, b) => Number(a.internalDate ?? 0) - Number(b.internalDate ?? 0),
        );
        const latest = chronological[chronological.length - 1];
        if (!latest) {
          return;
        }
        const existing = await input.store.getThread(input.connectionId, gmailThreadId);
        const context = buildThreadContext(chronological, userEmails);
        const latestDirection = context.messages.at(-1)?.direction ?? "UNKNOWN";
        const latestAt = receivedAtIso(latest.internalDate);

        let analysis = existing ? analysisFromStoredThread(existing) : null;
        const unchanged =
          existing?.lastAnalyzedMessageId != null && existing.lastAnalyzedMessageId === latest.gmailMessageId;

        if (!unchanged) {
          const outcome = await analyze(
            threadAnalysisInputFromContext(context, userEmails, {
              vipSenders: settings.vipSenders,
              ignoreSenders: settings.ignoredSenders,
            }),
            provider,
          );
          if (!outcome.ok) {
            threadFailures += 1;
            const threadId = await input.store.upsertThread({
              userId: input.userId,
              connectionId: input.connectionId,
              gmailThreadId,
              subject: latest.subject,
              participants: participantsOf(chronological),
              latestMessageAt: latestAt,
              latestMessageDirection: latestDirection,
              analysis,
              lastAnalyzedMessageId: existing?.lastAnalyzedMessageId ?? null,
              promptVersion: analysis ? TRIAGE_PROMPT_VERSION : null,
              modelName: analysis ? modelName : null,
            });
            for (const message of chronological) {
              const from = parseEmailAddress(message.from);
              await input.store.upsertMessage({
                userId: input.userId,
                connectionId: input.connectionId,
                threadId,
                message,
                direction: classifyDirection({
                  from,
                  to: parseAddressList(message.to),
                  cc: parseAddressList(message.cc),
                  userEmails,
                }),
                receivedAt: receivedAtIso(message.internalDate),
                contentHash: messageContentHash(message),
              });
              messagesProcessed += 1;
            }
            return;
          }
          analysis = outcome.analysis;
          threadsAnalyzed += 1;
        }

        const threadId = await input.store.upsertThread({
          userId: input.userId,
          connectionId: input.connectionId,
          gmailThreadId,
          subject: latest.subject,
          participants: participantsOf(chronological),
          latestMessageAt: latestAt,
          latestMessageDirection: latestDirection,
          analysis,
          lastAnalyzedMessageId: analysis ? latest.gmailMessageId : (existing?.lastAnalyzedMessageId ?? null),
          promptVersion: analysis ? TRIAGE_PROMPT_VERSION : null,
          modelName: analysis ? modelName : null,
        });

        for (const message of chronological) {
          const from = parseEmailAddress(message.from);
          await input.store.upsertMessage({
            userId: input.userId,
            connectionId: input.connectionId,
            threadId,
            message,
            direction: classifyDirection({
              from,
              to: parseAddressList(message.to),
              cc: parseAddressList(message.cc),
              userEmails,
            }),
            receivedAt: receivedAtIso(message.internalDate),
            contentHash: messageContentHash(message),
          });
          messagesProcessed += 1;
        }

        if (analysis) {
          analyses.push(analysis);
          const existingAction = await input.store.getAction(threadId);
          const nextAction = reconcileActionItem({
            analysis,
            existing: existingAction,
            latestDirection,
            latestMessageAt: latestAt,
          });
          if (nextAction) {
            await input.store.upsertAction(input.userId, threadId, nextAction);
          }

          const desiredLogical = logicalLabelsForAnalysis(analysis);
          const desiredIds = desiredLogical
            .map((name) => labelMap.get(name))
            .filter((id): id is string => typeof id === "string");
          const currentIds = mailpilotIdsOnMessage(latest.labelIds, labelMap);
          const diff = labelDiff(currentIds, desiredIds);
          await input.gmail.modifyThreadLabels(gmailThreadId, diff.addLabelIds, diff.removeLabelIds);
        }
      } catch {
        threadFailures += 1;
      }
    });

    const tallies = countersFromAnalyses(analyses);
    const counters = {
      ...EMPTY_SCAN_COUNTERS,
      messagesDiscovered: refs.length,
      messagesProcessed,
      threadsAnalyzed,
      ...tallies,
    };
    const status = threadFailures > 0 ? "PARTIAL" : "SUCCESS";
    const finishedAt = new Date().toISOString();
    await input.store.updateScanRun(scanId, { ...counters, status, finishedAt });

    const historyId = await input.gmail.getProfileHistoryId();
    const nextScanAt = nextDailyScanAt(
      now,
      settings.dailyScanTime ?? "08:00",
      settings.timezone || "Asia/Jerusalem",
    );
    await input.store.updateConnectionScan({
      connectionId: input.connectionId,
      historyId,
      lastSuccessfulScanAt: finishedAt,
      lastAttemptedScanAt: finishedAt,
      nextScanAt: nextScanAt.toISOString(),
    });

    return { scanId, status, counters, lookbackDays };
  } catch (error) {
    const message = error instanceof Error ? error.message : "scan_failed";
    await input.store.updateScanRun(scanId, {
      status: "FAILED",
      finishedAt: new Date().toISOString(),
      errorCode: "scan_failed",
      errorMessage: message,
    });
    await input.store.updateConnectionScan({
      connectionId: input.connectionId,
      historyId: null,
      lastAttemptedScanAt: new Date().toISOString(),
      nextScanAt: null,
    });
    throw error;
  }
}
