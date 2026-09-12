import { createHash } from "node:crypto";

import { tryAnalyzeThread, type EmailTriageProvider } from "@/lib/ai/analyze-thread";
import { TRIAGE_PROMPT_VERSION } from "@/lib/ai/prompts";
import { threadAnalysisSchema, type ThreadAnalysis } from "@/lib/ai/schemas";
import { threadAnalysisInputFromContext } from "@/lib/ai/types";
import { reconcileActionItem } from "@/lib/actions/reconcile-action";
import { getContextLimits, type ContextLimits } from "@/lib/config/env";
import { classifyDirection, parseAddressList, parseEmailAddress } from "@/lib/gmail/addresses";
import { mergeUserEmails, safeListSendAsEmails } from "@/lib/gmail/aliases";
import type { GmailPilotLogicalLabel } from "@/lib/gmail/constants";
import { labelDiff, logicalLabelsForAnalysis } from "@/lib/gmail/label-plan";
import type { ParsedGmailMessage } from "@/lib/gmail/parser";
import { GmailConnectError } from "@/lib/gmail/oauth";
import { isGmailAuthError, isGmailQuotaError } from "@/lib/gmail/retry";
import { isAiUnavailableError, SCAN_IN_PROGRESS, scanUserMessage } from "@/lib/scans/errors";
import { buildThreadContext } from "@/lib/gmail/thread-context";
import { messageContentHash } from "@/lib/scans/content-hash";
import {
  buildInitialScanQuery,
  buildOverlapScanQuery,
  DEFAULT_LOOKBACK_DAYS,
  overlapWindowStart,
  scanWindow,
  type InitialLookbackDays,
} from "@/lib/scans/lookback";
import { plannedDiscoveryMode } from "@/lib/scans/mode";
import { mapPool } from "@/lib/scans/pool";
import { nextDailyScanAt } from "@/lib/scans/schedule";
import { formatThreadFailureMessage } from "@/lib/scans/thread-failures";
import { emitProductEvent } from "@/lib/observability/events";
import {
  countersFromAnalyses,
  EMPTY_SCAN_COUNTERS,
  type ConnectionScanState,
  type ScanDiscoveryMode,
  type ScanGmailPort,
  type ScanRunResult,
  type ScanSettings,
  type ScanStorePort,
  type ScanTriggerType,
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

function participantsOf(
  messages: ParsedGmailMessage[],
): Array<{ email: string; name: string | null }> {
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

function managedLabelIdsOnMessage(
  labelIds: string[],
  labelMap: Map<GmailPilotLogicalLabel, string>,
): string[] {
  const ours = new Set(labelMap.values());
  return labelIds.filter((id) => ours.has(id));
}

export function shouldReuseStoredAnalysis(
  existing: StoredThreadRow | null,
  latestMessageId: string,
  promptVersion: string,
): boolean {
  return (
    existing?.lastAnalyzedMessageId != null &&
    existing.lastAnalyzedMessageId === latestMessageId &&
    existing.promptVersion === promptVersion
  );
}

export function triageSettingsFingerprint(settings: ScanSettings): string {
  const payload = JSON.stringify({
    vip: [...settings.vipSenders].map((value) => value.toLowerCase()).sort(),
    ignored: [...settings.ignoredSenders].map((value) => value.toLowerCase()).sort(),
    domains: [...settings.ignoredDomains].map((value) => value.toLowerCase()).sort(),
    custom: settings.customAiInstructions.trim(),
  });
  return createHash("sha256").update(payload).digest("hex").slice(0, 16);
}

export function analysisPromptKey(settings: ScanSettings): string {
  return `${TRIAGE_PROMPT_VERSION}:${triageSettingsFingerprint(settings)}`;
}

export function analysisFromStoredThread(row: StoredThreadRow): ThreadAnalysis | null {
  if (!row.analysis) {
    return null;
  }
  const parsed = threadAnalysisSchema.safeParse(row.analysis);
  return parsed.success ? parsed.data : null;
}

async function discoverChangedMessages(input: {
  gmail: ScanGmailPort;
  lookbackDays: InitialLookbackDays;
  now: Date;
  state: ConnectionScanState;
  forceLookback?: boolean;
}): Promise<{
  mode: ScanDiscoveryMode;
  refs: Array<{ id: string; threadId: string }>;
  windowStart: Date;
  windowEnd: Date;
}> {
  const planned = plannedDiscoveryMode(input.state, { forceLookback: input.forceLookback });
  const windowEnd = input.now;

  if (planned === "INCREMENTAL" && input.state.historyId) {
    const history = await input.gmail.listHistoryChanges(input.state.historyId);
    if (history.ok) {
      const lastSuccess = input.state.lastSuccessfulScanAt
        ? new Date(input.state.lastSuccessfulScanAt)
        : windowEnd;
      return {
        mode: "INCREMENTAL",
        refs: history.refs,
        windowStart: lastSuccess,
        windowEnd,
      };
    }
  }

  if (planned === "INCREMENTAL" || planned === "RECOVERY") {
    const lastSuccess = input.state.lastSuccessfulScanAt
      ? new Date(input.state.lastSuccessfulScanAt)
      : windowEnd;
    return {
      mode: "RECOVERY",
      refs: await input.gmail.listMessageRefs(buildOverlapScanQuery(lastSuccess, input.now)),
      windowStart: overlapWindowStart(lastSuccess, input.now),
      windowEnd,
    };
  }

  const window = scanWindow(input.lookbackDays, input.now);
  return {
    mode: "INITIAL",
    refs: await input.gmail.listMessageRefs(buildInitialScanQuery(input.lookbackDays)),
    windowStart: window.windowStart,
    windowEnd: window.windowEnd,
  };
}

export type ProcessGmailScanInput = {
  userId: string;
  connectionId: string;
  gmailEmail: string;
  lookbackDays?: InitialLookbackDays;
  triggerType?: ScanTriggerType;
  forceLookback?: boolean;
  now?: Date;
  gmail: ScanGmailPort;
  store: ScanStorePort;
  analyze?: typeof tryAnalyzeThread;
  provider: EmailTriageProvider;
  modelName: string;
};

export async function processGmailScan(input: ProcessGmailScanInput): Promise<ScanRunResult> {
  return processInitialScan(input);
}

export type PreparedGmailScan = {
  scanId: string;
  lookbackDays: InitialLookbackDays;
  now: Date;
  analyze: typeof tryAnalyzeThread;
  modelName: string;
  provider: EmailTriageProvider;
  limits: ContextLimits;
  state: ConnectionScanState;
  settings: ScanSettings;
  userEmails: string[];
  userId: string;
  connectionId: string;
  gmail: ScanGmailPort;
  store: ScanStorePort;
  forceLookback?: boolean;
};

export async function openGmailScan(input: ProcessGmailScanInput): Promise<PreparedGmailScan> {
  const lookbackDays = input.lookbackDays ?? DEFAULT_LOOKBACK_DAYS;
  const now = input.now ?? new Date();
  const analyze = input.analyze ?? tryAnalyzeThread;
  const modelName = input.modelName;
  const provider = input.provider;
  const limits = getContextLimits();

  const running = await input.store.findRunningScan(input.connectionId);
  if (running?.startedAt) {
    const started = Date.parse(running.startedAt);
    if (Number.isFinite(started) && now.getTime() - started < STALE_RUNNING_MS) {
      throw new Error(SCAN_IN_PROGRESS);
    }
    await input.store.failScan(running.id, "stale_lease", "Previous scan lease expired");
  } else if (running) {
    await input.store.failScan(running.id, "stale_lease", "Previous scan lease expired");
  }

  const state = await input.store.getConnectionScanState(input.connectionId);
  const planned = plannedDiscoveryMode(state, { forceLookback: input.forceLookback });
  const triggerType: ScanTriggerType =
    planned === "RECOVERY"
      ? "RECOVERY"
      : (input.triggerType ?? (planned === "INITIAL" ? "INITIAL" : "MANUAL"));
  const plannedWindow =
    planned === "INITIAL"
      ? scanWindow(lookbackDays, now)
      : {
          windowStart: state.lastSuccessfulScanAt
            ? overlapWindowStart(new Date(state.lastSuccessfulScanAt), now)
            : now,
          windowEnd: now,
        };

  const settings = await input.store.getSettings(input.userId);
  const sendAsEmails = await safeListSendAsEmails(input.gmail.listSendAsEmails?.bind(input.gmail));

  const scanId = await input.store.insertScanRun({
    userId: input.userId,
    connectionId: input.connectionId,
    triggerType,
    windowStart: plannedWindow.windowStart.toISOString(),
    windowEnd: plannedWindow.windowEnd.toISOString(),
  });
  await input.store.updateConnectionScan({
    connectionId: input.connectionId,
    historyId: null,
    lastAttemptedScanAt: now.toISOString(),
  });

  return {
    scanId,
    lookbackDays,
    now,
    analyze,
    modelName,
    provider,
    limits,
    state,
    settings,
    userEmails: mergeUserEmails([input.gmailEmail], sendAsEmails),
    userId: input.userId,
    connectionId: input.connectionId,
    gmail: input.gmail,
    store: input.store,
    forceLookback: input.forceLookback,
  };
}

/** @deprecated Use processGmailScan. Kept as the Phase 5 entry name. */
export async function processInitialScan(input: ProcessGmailScanInput): Promise<ScanRunResult> {
  return executeGmailScan(await openGmailScan(input));
}

export async function executeGmailScan(prepared: PreparedGmailScan): Promise<ScanRunResult> {
  const {
    scanId,
    lookbackDays,
    now,
    analyze,
    modelName,
    provider,
    limits,
    state,
    settings,
    userEmails,
    userId,
    connectionId,
    gmail,
    store,
    forceLookback,
  } = prepared;
  const startedMs = Date.now();
  emitProductEvent({
    type: "scan.started",
    scanId,
    connectionId,
    lookbackDays,
  });

  try {
    const historyBoundary = await gmail.getProfileHistoryId();
    const discovery = await discoverChangedMessages({
      gmail,
      lookbackDays,
      now,
      state,
      forceLookback,
    });
    const refs = discovery.refs;
    const retryThreadIds = await store.listPendingFailedThreadIds(connectionId, scanId);
    const threadIds = uniqueThreadIds([
      ...refs,
      ...retryThreadIds.map((threadId) => ({ threadId })),
    ]);
    const analyses: ThreadAnalysis[] = [];
    const failedGmailThreadIds: string[] = [];
    let threadsAnalyzed = 0;
    let threadsChecked = 0;
    let threadFailures = 0;
    let messagesProcessed = 0;
    let progressWrites = Promise.resolve();
    const labelMap =
      threadIds.length > 0 ? await gmail.loadLabelMap() : new Map<GmailPilotLogicalLabel, string>();

    await store.updateScanRun(scanId, {
      status: "RUNNING",
      messagesDiscovered: refs.length,
      threadsDiscovered: threadIds.length,
      threadsChecked: 0,
    });

    const persistProgress = () => {
      const checked = threadsChecked;
      const processed = messagesProcessed;
      progressWrites = progressWrites.then(async () => {
        try {
          await store.updateScanRun(scanId, {
            status: "RUNNING",
            messagesDiscovered: refs.length,
            messagesProcessed: processed,
            threadsDiscovered: threadIds.length,
            threadsChecked: checked,
          });
        } catch {
          // Live progress is best-effort; the final write still records totals.
        }
      });
    };

    const analysisKey = analysisPromptKey(settings);
    await mapPool(threadIds, limits.AI_MAX_CONCURRENCY, async (gmailThreadId) => {
      try {
        const messages = await gmail.fetchThread(gmailThreadId);
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
        const existing = await store.getThread(connectionId, gmailThreadId);
        const context = buildThreadContext(chronological, userEmails);
        const latestDirection = context.messages.at(-1)?.direction ?? "UNKNOWN";
        const latestAt = receivedAtIso(latest.internalDate);

        let analysis = existing ? analysisFromStoredThread(existing) : null;
        const unchanged = shouldReuseStoredAnalysis(existing, latest.gmailMessageId, analysisKey);

        if (!unchanged) {
          const outcome = await analyze(
            threadAnalysisInputFromContext(context, userEmails, {
              vipSenders: settings.vipSenders,
              ignoreSenders: settings.ignoredSenders,
              ignoreDomains: settings.ignoredDomains,
              customInstructions: settings.customAiInstructions,
            }),
            provider,
          );
          if (!outcome.ok) {
            threadFailures += 1;
            failedGmailThreadIds.push(gmailThreadId);
            const threadId = await store.upsertThread({
              userId,
              connectionId,
              gmailThreadId,
              subject: latest.subject,
              participants: participantsOf(chronological),
              latestMessageAt: latestAt,
              latestMessageDirection: latestDirection,
              analysis,
              lastAnalyzedMessageId: existing?.lastAnalyzedMessageId ?? null,
              promptVersion: analysis ? (existing?.promptVersion ?? null) : null,
              modelName: analysis ? modelName : null,
            });
            for (const message of chronological) {
              const from = parseEmailAddress(message.from);
              await store.upsertMessage({
                userId,
                connectionId,
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
          emitProductEvent({
            type: "thread.analyzed",
            scanId,
            threadReused: 0,
            status: analysis.status,
            category: analysis.category,
            requiresAction: analysis.requires_action,
          });
        }

        const threadId = await store.upsertThread({
          userId,
          connectionId,
          gmailThreadId,
          subject: latest.subject,
          participants: participantsOf(chronological),
          latestMessageAt: latestAt,
          latestMessageDirection: latestDirection,
          analysis,
          lastAnalyzedMessageId: analysis
            ? latest.gmailMessageId
            : (existing?.lastAnalyzedMessageId ?? null),
          promptVersion: analysis ? analysisKey : null,
          modelName: analysis ? modelName : null,
        });

        for (const message of chronological) {
          const from = parseEmailAddress(message.from);
          await store.upsertMessage({
            userId,
            connectionId,
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
          const existingAction = await store.getAction(threadId);
          const nextAction = reconcileActionItem({
            analysis,
            existing: existingAction,
            latestDirection,
            latestMessageAt: latestAt,
          });
          if (nextAction) {
            emitProductEvent({
              type: "action.upserted",
              threadId,
              status: nextAction.status,
              created: existingAction ? 0 : 1,
            });
            await store.upsertAction(userId, threadId, nextAction);
          }

          const desiredLogical = logicalLabelsForAnalysis(analysis);
          const desiredIds = desiredLogical
            .map((name) => labelMap.get(name))
            .filter((id): id is string => typeof id === "string");
          const currentIds = managedLabelIdsOnMessage(latest.labelIds, labelMap);
          const diff = labelDiff(currentIds, desiredIds);
          await gmail.modifyThreadLabels(gmailThreadId, diff.addLabelIds, diff.removeLabelIds);
        }
      } catch (error) {
        if (
          isGmailAuthError(error) ||
          (error instanceof GmailConnectError && error.reason === "reauth_required")
        ) {
          throw error;
        }
        threadFailures += 1;
        failedGmailThreadIds.push(gmailThreadId);
      } finally {
        threadsChecked += 1;
        persistProgress();
      }
    });
    await progressWrites;

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
    await store.updateScanRun(scanId, {
      ...counters,
      status,
      finishedAt,
      threadsDiscovered: threadIds.length,
      threadsChecked,
      errorCode: status === "PARTIAL" ? "partial_thread_failures" : null,
      errorMessage: status === "PARTIAL" ? formatThreadFailureMessage(failedGmailThreadIds) : null,
    });

    // Advance the History API cursor only after a fully successful scan. A PARTIAL
    // run must keep the previous historyId so failed threads are rediscovered.
    // Use the start-of-scan profile historyId so mail that arrived during the
    // run is not skipped on the next incremental sync.
    const nextScanAt = nextDailyScanAt(
      now,
      settings.dailyScanTime ?? "08:00",
      settings.timezone || "Asia/Jerusalem",
    );
    await store.updateConnectionScan({
      connectionId,
      ...(status === "SUCCESS"
        ? {
            historyId: historyBoundary,
            lastSuccessfulScanAt: finishedAt,
          }
        : {}),
      lastAttemptedScanAt: finishedAt,
      nextScanAt: nextScanAt.toISOString(),
    });

    emitProductEvent({
      type: status === "PARTIAL" ? "scan.partial" : "scan.completed",
      scanId,
      status,
      threadsAnalyzed,
      threadFailures,
      durationMs: Date.now() - startedMs,
      errorCode: status === "PARTIAL" ? "partial_thread_failures" : null,
    });

    return { scanId, status, counters, lookbackDays, mode: discovery.mode };
  } catch (error) {
    const reauth =
      isGmailAuthError(error) ||
      (error instanceof GmailConnectError && error.reason === "reauth_required");
    const quota = isGmailQuotaError(error);
    const aiDown = isAiUnavailableError(error);
    const errorCode = reauth
      ? "reauth_required"
      : quota
        ? "gmail_quota"
        : aiDown
          ? "ai_unavailable"
          : "scan_failed";
    if (reauth) {
      await store.markConnectionReauthRequired(connectionId);
    }
    await store.updateScanRun(scanId, {
      status: "FAILED",
      finishedAt: new Date().toISOString(),
      errorCode,
      errorMessage: scanUserMessage(errorCode),
    });
    await store.updateConnectionScan({
      connectionId,
      historyId: null,
      lastAttemptedScanAt: new Date().toISOString(),
      nextScanAt: null,
    });
    emitProductEvent({
      type: "scan.failed",
      scanId,
      connectionId,
      errorCode,
      durationMs: Date.now() - startedMs,
    });
    throw error;
  }
}
