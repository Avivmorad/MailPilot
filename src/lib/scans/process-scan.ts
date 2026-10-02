import { createHash } from "node:crypto";

import { tryAnalyzeThread, type EmailTriageProvider } from "@/lib/ai/analyze-thread";
import { TRIAGE_PROMPT_VERSION } from "@/lib/ai/prompts";
import { threadAnalysisSchema, type ThreadAnalysis } from "@/lib/ai/schemas";
import { threadAnalysisInputFromContext } from "@/lib/ai/types";
import { createScanUsageRecorder } from "@/lib/ai/usage";
import { reconcileActionItem } from "@/lib/actions/reconcile-action";
import { getContextLimits, type ContextLimits } from "@/lib/config/env";
import { classifyDirection, parseAddressList, parseEmailAddress } from "@/lib/gmail/addresses";
import { mergeUserEmails, safeListSendAsEmails } from "@/lib/gmail/aliases";
import type { MailPilotLogicalLabel } from "@/lib/gmail/constants";
import { labelDiff, logicalLabelsForAnalysis } from "@/lib/gmail/label-plan";
import type { ParsedGmailMessage } from "@/lib/gmail/parser";
import { GmailConnectError } from "@/lib/gmail/oauth";
import { isGmailAuthError, isGmailQuotaError } from "@/lib/gmail/retry";
import {
  assertGmailBudget,
  GMAIL_REQUEST_TIMEOUT_MS,
  GmailDeadlineError,
  GmailRequestTimeoutError,
  withGmailRequest,
} from "@/lib/gmail/request-budget";
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
import { advanceContiguousCursor } from "@/lib/scans/progress";
import {
  DISPATCH_LEASE_SECONDS,
  SCAN_STALE_PROGRESS_MS,
  SCAN_WORK_BUDGET_MS,
} from "@/lib/scans/dispatch-budget";
import {
  SCAN_SLICE_LEASE_LOST,
  refreshScanJobLease,
  stillHoldsScanJob,
  type ScanJobLease,
} from "@/lib/scans/jobs";
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

export { SCAN_WORK_BUDGET_MS, SCAN_STALE_PROGRESS_MS };

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

function mailpilotIdsOnMessage(
  labelIds: string[],
  labelMap: Map<MailPilotLogicalLabel, string>,
): string[] {
  const ours = new Set(labelMap.values());
  return labelIds.filter((id) => ours.has(id));
}

export function triageFailureCode(error: unknown): string {
  if (error instanceof GmailRequestTimeoutError) {
    return "request_timeout";
  }
  if (error instanceof GmailDeadlineError) {
    return "slice_deadline";
  }
  const status = nestedNumberField(error, "status");
  if (status) {
    return `http_${status}`;
  }
  if (nestedMessageMatches(error, /timed out/i)) {
    return "provider_timeout";
  }
  const code = deepestTriageCode(error);
  if (code) {
    return code;
  }
  if (error instanceof Error && /^[A-Za-z]+$/.test(error.name)) {
    const head = error.message.split(":")[0]?.trim() ?? "";
    const slug = head
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_|_$/g, "")
      .slice(0, 60);
    if (slug && slug !== "error") {
      return slug;
    }
    return error.name;
  }
  return "unknown";
}

/** Provider calls abort themselves after this long. */
const ANALYSIS_TIMEOUT_RETRY_MS = 25_000;

/**
 * A retry repeats the whole thread: Gmail fetch, one provider attempt, then
 * the label write. Each Gmail call can consume a full request timeout.
 */
const TIMEOUT_RETRY_BUDGET_MS =
  GMAIL_REQUEST_TIMEOUT_MS + ANALYSIS_TIMEOUT_RETRY_MS + GMAIL_REQUEST_TIMEOUT_MS;

export function isRecoverableAnalysisTimeout(error: unknown): boolean {
  const code = triageFailureCode(error);
  return code === "request_timeout" || code === "provider_timeout";
}

function anotherAttemptFits(budget: { deadlineAt?: number }, attemptMs: number): boolean {
  if (budget.deadlineAt === undefined) {
    return true;
  }
  return budget.deadlineAt - Date.now() >= attemptMs;
}

function nestedDeadline(error: unknown): GmailDeadlineError | undefined {
  let current: unknown = error;
  for (let depth = 0; current && typeof current === "object" && depth < 5; depth += 1) {
    if (current instanceof GmailDeadlineError) {
      return current;
    }
    current = (current as { cause?: unknown }).cause;
  }
  return undefined;
}

function deepestTriageCode(error: unknown): string | undefined {
  let found: string | undefined;
  let current: unknown = error;
  for (let depth = 0; current && typeof current === "object" && depth < 5; depth += 1) {
    const record = current as Record<string, unknown>;
    if (record.code === "schema" || record.code === "invariants" || record.code === "provider") {
      found = record.code;
    }
    current = record.cause;
  }
  return found;
}

function nestedNumberField(error: unknown, key: string, depth = 0): number | undefined {
  if (!error || typeof error !== "object" || depth > 4) {
    return undefined;
  }
  const record = error as Record<string, unknown>;
  const response = record.response;
  if (response && typeof response === "object") {
    const responseStatus = (response as { status?: unknown }).status;
    if (typeof responseStatus === "number") {
      return responseStatus;
    }
  }
  if (typeof record[key] === "number") {
    return record[key];
  }
  return nestedNumberField(record.cause, key, depth + 1);
}

function nestedMessageMatches(error: unknown, pattern: RegExp, depth = 0): boolean {
  if (!error || typeof error !== "object" || depth > 4) {
    return false;
  }
  const record = error as Record<string, unknown>;
  if (typeof record.message === "string" && pattern.test(record.message)) {
    return true;
  }
  return nestedMessageMatches(record.cause, pattern, depth + 1);
}

export function shouldReuseStoredAnalysis(
  existing: StoredThreadRow | null,
  latestMessageId: string,
  promptVersion: string,
): boolean {
  // Reuse only when the cached analysis is still parseable. Otherwise a later
  // upsert with analysis=null would wipe user-facing fields and leave blanks.
  return (
    existing?.analysis != null &&
    existing.lastAnalyzedMessageId != null &&
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
  resume?: boolean;
  jobLease?: ScanJobLease;
};

export async function openGmailScan(input: ProcessGmailScanInput): Promise<PreparedGmailScan> {
  const lookbackDays = input.lookbackDays ?? DEFAULT_LOOKBACK_DAYS;
  const now = input.now ?? new Date();
  const analyze = input.analyze ?? tryAnalyzeThread;
  const modelName = input.modelName;
  const provider = input.provider;
  const limits = getContextLimits();

  const running = await input.store.findRunningScan(input.connectionId);
  if (running) {
    const stamp = running.updatedAt ?? running.startedAt;
    const progressed = stamp ? Date.parse(stamp) : NaN;
    if (Number.isFinite(progressed) && now.getTime() - progressed < SCAN_STALE_PROGRESS_MS) {
      throw new Error(SCAN_IN_PROGRESS);
    }
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
    lookbackDays,
  });
  try {
    await input.store.updateConnectionScan({
      connectionId: input.connectionId,
      lastAttemptedScanAt: now.toISOString(),
    });
  } catch (error) {
    try {
      await input.store.failScan(scanId, "scan_preparation_failed", scanUserMessage("scan_failed"));
    } catch (cleanupError) {
      throw new AggregateError([error, cleanupError], "Scan preparation and run cleanup failed");
    }
    throw error;
  }

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
    resume: false,
  };
}

export async function resumeGmailScan(input: {
  scanId: string;
  gmailEmail: string;
  gmail: ScanGmailPort;
  store: ScanStorePort;
  provider: EmailTriageProvider;
  modelName: string;
  analyze?: typeof tryAnalyzeThread;
  now?: Date;
}): Promise<PreparedGmailScan> {
  const checkpoint = await input.store.getScanCheckpoint(input.scanId);
  if (!checkpoint) {
    throw new Error("scan_not_found");
  }
  const now = input.now ?? new Date();
  const settings = await input.store.getSettings(checkpoint.userId);
  const sendAsEmails = await safeListSendAsEmails(input.gmail.listSendAsEmails?.bind(input.gmail));
  const state = await input.store.getConnectionScanState(checkpoint.connectionId);
  return {
    scanId: checkpoint.scanId,
    lookbackDays: checkpoint.lookbackDays,
    now,
    analyze: input.analyze ?? tryAnalyzeThread,
    modelName: input.modelName,
    provider: input.provider,
    limits: getContextLimits(),
    state,
    settings,
    userEmails: mergeUserEmails([input.gmailEmail], sendAsEmails),
    userId: checkpoint.userId,
    connectionId: checkpoint.connectionId,
    gmail: input.gmail,
    store: input.store,
    resume: true,
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
    jobLease,
  } = prepared;
  const startedMs = Date.now();
  const requestBudget = gmail.requestBudget ?? { deadlineAt: startedMs + SCAN_WORK_BUDGET_MS };
  // Live progress can include in-flight writes. Only this completed-prefix
  // snapshot is restored when a request deadline interrupts a batch.
  let durableProgress = {
    ...EMPTY_SCAN_COUNTERS,
    threadCursor: 0,
    threadsChecked: 0,
    failedThreadIds: [] as string[],
  };
  const assertJobLease = async (): Promise<void> => {
    if (!jobLease) {
      return;
    }
    const held = await stillHoldsScanJob(jobLease.jobId, jobLease.workerId);
    if (!held) {
      throw new Error(SCAN_SLICE_LEASE_LOST);
    }
  };
  const holdsJobLease = async (): Promise<boolean> => {
    if (!jobLease) {
      return true;
    }
    return stillHoldsScanJob(jobLease.jobId, jobLease.workerId);
  };
  emitProductEvent({
    type: "scan.started",
    scanId,
    connectionId,
    lookbackDays,
  });

  const asFailedResult = (mode: ScanDiscoveryMode): ScanRunResult => ({
    scanId,
    status: "FAILED",
    counters: EMPTY_SCAN_COUNTERS,
    lookbackDays,
    mode,
  });

  try {
    const liveStatus = await store.getScanStatus(scanId);
    if (liveStatus && liveStatus !== "RUNNING") {
      return asFailedResult("INITIAL");
    }
    await assertJobLease();
    if (jobLease) {
      const refreshed = await refreshScanJobLease(
        jobLease.jobId,
        jobLease.workerId,
        DISPATCH_LEASE_SECONDS,
      );
      if (!refreshed) {
        throw new Error(SCAN_SLICE_LEASE_LOST);
      }
    }
    const checkpoint = await store.getScanCheckpoint(scanId);
    durableProgress = {
      messagesDiscovered: checkpoint?.messagesDiscovered ?? 0,
      messagesProcessed: checkpoint?.messagesProcessed ?? 0,
      threadsAnalyzed: checkpoint?.threadsAnalyzed ?? 0,
      importantCount: checkpoint?.importantCount ?? 0,
      actionCount: checkpoint?.actionCount ?? 0,
      replyCount: checkpoint?.replyCount ?? 0,
      waitingCount: checkpoint?.waitingCount ?? 0,
      informationalCount: checkpoint?.informationalCount ?? 0,
      ignoredCount: checkpoint?.ignoredCount ?? 0,
      threadCursor: checkpoint?.threadCursor ?? 0,
      threadsChecked: checkpoint?.threadCursor ?? 0,
      failedThreadIds: [...(checkpoint?.failedThreadIds ?? [])],
    };
    if (!(await store.updateScanRun(scanId, { status: "RUNNING" }))) {
      return asFailedResult(checkpoint?.discoveryMode ?? "INITIAL");
    }
    assertGmailBudget(requestBudget);
    let historyBoundary = checkpoint?.historyBoundary ?? null;
    let discoveryMode: ScanDiscoveryMode = checkpoint?.discoveryMode ?? "INITIAL";
    let messagesDiscovered = checkpoint?.messagesDiscovered ?? 0;
    let threadIds = checkpoint?.discoveredThreadIds ?? [];
    let cursor = checkpoint?.threadCursor ?? 0;
    const failedGmailThreadIds = [...(checkpoint?.failedThreadIds ?? [])];
    const analyses: ThreadAnalysis[] = [];
    let threadsAnalyzed = checkpoint?.threadsAnalyzed ?? 0;
    let messagesProcessed = checkpoint?.messagesProcessed ?? 0;
    const priorTallies = {
      importantCount: checkpoint?.importantCount ?? 0,
      actionCount: checkpoint?.actionCount ?? 0,
      replyCount: checkpoint?.replyCount ?? 0,
      waitingCount: checkpoint?.waitingCount ?? 0,
      informationalCount: checkpoint?.informationalCount ?? 0,
      ignoredCount: checkpoint?.ignoredCount ?? 0,
    };

    if (!checkpoint?.discoveryComplete) {
      historyBoundary = await gmail.getProfileHistoryId();
      const discovery = await discoverChangedMessages({
        gmail,
        lookbackDays,
        now,
        state,
        forceLookback,
      });
      discoveryMode = discovery.mode;
      messagesDiscovered = discovery.refs.length;
      const retryThreadIds = await store.listPendingFailedThreadIds(connectionId, scanId);
      threadIds = uniqueThreadIds([
        ...discovery.refs,
        ...retryThreadIds.map((threadId) => ({ threadId })),
      ]);
      cursor = 0;
      await assertJobLease();
      const discovered = await store.updateScanRun(scanId, {
        status: "RUNNING",
        lookbackDays,
        discoveryMode,
        discoveryComplete: true,
        discoveredThreadIds: threadIds,
        threadCursor: 0,
        historyBoundary,
        messagesDiscovered,
        threadsDiscovered: threadIds.length,
        threadsChecked: 0,
      });
      if (!discovered) return asFailedResult(discoveryMode);
      durableProgress = {
        ...durableProgress,
        messagesDiscovered,
        threadCursor: 0,
        threadsChecked: 0,
      };
    }

    const labelMap =
      threadIds.length > 0 ? await gmail.loadLabelMap() : new Map<MailPilotLogicalLabel, string>();
    let progressWrites = Promise.resolve();
    let threadsChecked = cursor;
    const finishedIndexes = new Set<number>();

    const persistProgress = () => {
      const checked = threadsChecked;
      progressWrites = progressWrites.then(async () => {
        try {
          if (jobLease) {
            const held = await stillHoldsScanJob(jobLease.jobId, jobLease.workerId);
            if (!held) {
              return;
            }
          }
          await store.updateScanRun(scanId, {
            status: "RUNNING",
            messagesDiscovered,
            threadsDiscovered: threadIds.length,
            threadsChecked: checked,
          });
        } catch {
          // Live progress is best-effort; the final write still records totals.
        }
      });
    };

    const analysisKey = analysisPromptKey(settings);
    const onProviderUsage = createScanUsageRecorder({
      userId,
      connectionId,
      scanId,
      promptVersion: analysisKey,
    });
    const remaining = Math.max(0, threadIds.length - cursor);
    const workerCount = Math.min(Math.max(1, limits.AI_MAX_CONCURRENCY), Math.max(1, remaining));
    const persistMessages = async (
      threadId: string,
      messages: ParsedGmailMessage[],
    ): Promise<void> => {
      await mapPool(messages, limits.AI_MAX_CONCURRENCY, async (message) => {
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
      });
    };

    const currentCounters = () => {
      const tallies = countersFromAnalyses(analyses);
      return {
        messagesDiscovered,
        messagesProcessed,
        threadsAnalyzed,
        importantCount: priorTallies.importantCount + tallies.importantCount,
        actionCount: priorTallies.actionCount + tallies.actionCount,
        replyCount: priorTallies.replyCount + tallies.replyCount,
        waitingCount: priorTallies.waitingCount + tallies.waitingCount,
        informationalCount: priorTallies.informationalCount + tallies.informationalCount,
        ignoredCount: priorTallies.ignoredCount + tallies.ignoredCount,
      };
    };
    let stopAdmission = false;
    // Large lookbacks (~700 threads) are dominated by per-thread AI latency,
    // overlapped only up to AI_MAX_CONCURRENCY. Waves wait on a durable
    // checkpoint before the next fetch batch (see scan-timing-eval). Intra-wave
    // fetch/AI overlap and metadata-then-full Gmail probes are follow-ups.
    for (let batchStart = cursor; batchStart < threadIds.length; batchStart += workerCount) {
      let admitIndex = batchStart;
      const batchEnd = Math.min(batchStart + workerCount, threadIds.length);
      if ((await store.getScanStatus(scanId)) !== "RUNNING") {
        break;
      }
      if (!(await holdsJobLease())) {
        break;
      }
      if (requestBudget.deadlineAt !== undefined && Date.now() >= requestBudget.deadlineAt) {
        break;
      }
      const waveThreadIds = threadIds
        .slice(batchStart, batchEnd)
        .filter((id): id is string => Boolean(id));
      const storedByGmailId = await store.getThreadsByGmailIds(connectionId, waveThreadIds);
      await mapPool(
        Array.from({ length: workerCount }, (_, i) => i),
        workerCount,
        async () => {
          for (;;) {
            if (stopAdmission) {
              return;
            }
            if (requestBudget.deadlineAt !== undefined && Date.now() >= requestBudget.deadlineAt) {
              return;
            }
            const index = admitIndex;
            if (index >= batchEnd) {
              return;
            }
            admitIndex += 1;
            const gmailThreadId = threadIds[index];
            if (!gmailThreadId) {
              threadsChecked = advanceContiguousCursor(threadsChecked, finishedIndexes, index);
              persistProgress();
              continue;
            }
            for (let attempt = 0; attempt < 2; attempt += 1) {
              if (stopAdmission) {
                return;
              }
              if (
                requestBudget.deadlineAt !== undefined &&
                Date.now() >= requestBudget.deadlineAt
              ) {
                return;
              }
              let countTowardCursor = false;
              let analysisPersisted = false;
              try {
                const messages = await gmail.fetchThread(gmailThreadId);
                if (messages.length === 0) {
                  countTowardCursor = true;
                  break;
                }
                const chronological = [...messages].sort(
                  (a, b) => Number(a.internalDate ?? 0) - Number(b.internalDate ?? 0),
                );
                const latest = chronological[chronological.length - 1];
                if (!latest) {
                  countTowardCursor = true;
                  break;
                }
                const existing = storedByGmailId.get(gmailThreadId) ?? null;
                const context = buildThreadContext(chronological, userEmails);
                const latestDirection = context.messages.at(-1)?.direction ?? "UNKNOWN";
                const latestAt = receivedAtIso(latest.internalDate);

                let analysis = existing ? analysisFromStoredThread(existing) : null;
                let analysisScanId = existing?.analysisScanId ?? null;
                const unchanged = shouldReuseStoredAnalysis(
                  existing,
                  latest.gmailMessageId,
                  analysisKey,
                );

                if (!unchanged) {
                  const outcome = await withGmailRequest(
                    ({ signal }) =>
                      analyze(
                        threadAnalysisInputFromContext(context, userEmails, {
                          vipSenders: settings.vipSenders,
                          ignoreSenders: settings.ignoredSenders,
                          ignoreDomains: settings.ignoredDomains,
                          customInstructions: settings.customAiInstructions,
                        }),
                        provider,
                        { signal, onProviderUsage },
                      ),
                    {
                      ...requestBudget,
                      requestTimeoutMs:
                        requestBudget.deadlineAt === undefined
                          ? SCAN_WORK_BUDGET_MS
                          : Math.max(1, requestBudget.deadlineAt - Date.now()),
                    },
                  );
                  if (!(await holdsJobLease())) {
                    return;
                  }
                  if (!outcome.ok) {
                    const deadline = nestedDeadline(outcome.error);
                    if (deadline) {
                      stopAdmission = true;
                      throw deadline;
                    }
                    if (attempt === 0 && isRecoverableAnalysisTimeout(outcome.error)) {
                      if (!anotherAttemptFits(requestBudget, TIMEOUT_RETRY_BUDGET_MS)) {
                        stopAdmission = true;
                        throw new GmailDeadlineError();
                      }
                      continue;
                    }
                    emitProductEvent({
                      type: "thread.analysis_failed",
                      scanId,
                      errorCode: triageFailureCode(outcome.error),
                    });
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
                      analysisScanId,
                    });
                    await persistMessages(threadId, chronological);
                    countTowardCursor = true;
                    break;
                  }
                  analysis = outcome.analysis;
                  analysisScanId = scanId;
                  emitProductEvent({
                    type: "thread.analyzed",
                    scanId,
                    threadReused: 0,
                    status: analysis.status,
                    category: analysis.category,
                    requiresAction: analysis.requires_action,
                  });
                }

                if (!(await holdsJobLease())) {
                  return;
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
                  analysisScanId,
                });
                analysisPersisted = Boolean(analysis);

                // Thread upsert commits analysis and attribution in one row.
                // Replay outside the durable prefix recovers this count without
                // another provider call or counting a prior scan's cached result.
                if (analysis && analysisScanId === scanId) threadsAnalyzed += 1;

                await persistMessages(threadId, chronological);

                if (!(await holdsJobLease()) || (await store.getScanStatus(scanId)) !== "RUNNING") {
                  stopAdmission = true;
                  return;
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
                  const currentIds = mailpilotIdsOnMessage(latest.labelIds, labelMap);
                  const diff = labelDiff(currentIds, desiredIds);
                  if (diff.addLabelIds.length > 0 || diff.removeLabelIds.length > 0) {
                    await gmail.modifyThreadLabels(
                      gmailThreadId,
                      diff.addLabelIds,
                      diff.removeLabelIds,
                    );
                  }
                }
                countTowardCursor = true;
                break;
              } catch (error) {
                const deadline =
                  error instanceof GmailDeadlineError ? error : nestedDeadline(error);
                if (
                  deadline ||
                  isGmailAuthError(error) ||
                  (error instanceof GmailConnectError && error.reason === "reauth_required")
                ) {
                  stopAdmission = true;
                  throw deadline ?? error;
                }
                if (analysisPersisted && isRecoverableAnalysisTimeout(error)) {
                  stopAdmission = true;
                  throw new GmailDeadlineError();
                }
                if (
                  attempt === 0 &&
                  isRecoverableAnalysisTimeout(error) &&
                  anotherAttemptFits(requestBudget, TIMEOUT_RETRY_BUDGET_MS)
                ) {
                  continue;
                }
                if (attempt === 0 && isRecoverableAnalysisTimeout(error)) {
                  stopAdmission = true;
                  throw new GmailDeadlineError();
                }
                emitProductEvent({
                  type: "thread.analysis_failed",
                  scanId,
                  errorCode: triageFailureCode(error),
                });
                failedGmailThreadIds.push(gmailThreadId);
                countTowardCursor = true;
                break;
              } finally {
                if (countTowardCursor) {
                  threadsChecked = advanceContiguousCursor(threadsChecked, finishedIndexes, index);
                  persistProgress();
                }
              }
            }
          }
        },
      ).finally(() => progressWrites);
      await progressWrites;
      await assertJobLease();
      if ((await store.getScanStatus(scanId)) !== "RUNNING") {
        break;
      }
      // No workers remain in flight: cursor, failures, and counters describe
      // the same completed prefix even if this invocation is killed later.
      const batchCounters = currentCounters();
      const batchFailures = [...new Set(failedGmailThreadIds)];
      const saved = await store.updateScanRun(scanId, {
        ...batchCounters,
        status: "RUNNING",
        threadsDiscovered: threadIds.length,
        threadsChecked,
        threadCursor: threadsChecked,
        failedThreadIds: batchFailures,
        discoveryComplete: true,
      });
      if (saved) {
        durableProgress = {
          ...batchCounters,
          threadCursor: threadsChecked,
          threadsChecked,
          failedThreadIds: batchFailures,
        };
      } else {
        return asFailedResult(discoveryMode);
      }
      if (threadsChecked < batchEnd) {
        break;
      }
    }

    if ((await store.getScanStatus(scanId)) !== "RUNNING") {
      emitProductEvent({
        type: "scan.cancelled",
        scanId,
        connectionId,
        errorCode: "cancelled",
        durationMs: Date.now() - startedMs,
      });
      return asFailedResult(discoveryMode);
    }

    const nextCursor = threadsChecked;
    const counters = currentCounters();
    const uniqueFailed = [...new Set(failedGmailThreadIds)];

    await assertJobLease();
    if (nextCursor < threadIds.length) {
      const continued = await store.updateScanRun(scanId, {
        ...counters,
        status: "RUNNING",
        threadsDiscovered: threadIds.length,
        threadsChecked: nextCursor,
        threadCursor: nextCursor,
        failedThreadIds: uniqueFailed,
        discoveryComplete: true,
        discoveredThreadIds: threadIds,
        historyBoundary,
        lookbackDays,
        discoveryMode,
      });
      if (!continued) return asFailedResult(discoveryMode);
      emitProductEvent({
        type: "scan.continued",
        scanId,
        connectionId,
        threadsChecked: nextCursor,
        threadsDiscovered: threadIds.length,
        durationMs: Date.now() - startedMs,
      });
      return { scanId, status: "CONTINUED", counters, lookbackDays, mode: discoveryMode };
    }

    const status = uniqueFailed.length > 0 ? "PARTIAL" : "SUCCESS";
    const finishedAt = new Date().toISOString();
    const finalized = await store.updateScanRun(scanId, {
      ...counters,
      status,
      finishedAt,
      threadsDiscovered: threadIds.length,
      threadsChecked: threadIds.length,
      threadCursor: threadIds.length,
      failedThreadIds: uniqueFailed,
      errorCode: status === "PARTIAL" ? "partial_thread_failures" : null,
      errorMessage: status === "PARTIAL" ? formatThreadFailureMessage(uniqueFailed) : null,
    });
    if (!finalized) {
      emitProductEvent({
        type: "scan.cancelled",
        scanId,
        connectionId,
        errorCode: "cancelled",
        durationMs: Date.now() - startedMs,
      });
      return asFailedResult(discoveryMode);
    }

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
      threadFailures: uniqueFailed.length,
      durationMs: Date.now() - startedMs,
      errorCode: status === "PARTIAL" ? "partial_thread_failures" : null,
    });

    return { scanId, status, counters, lookbackDays, mode: discoveryMode };
  } catch (error) {
    const stopped = await store.getScanStatus(scanId);
    if (stopped && stopped !== "RUNNING") {
      return asFailedResult("INITIAL");
    }
    // Lease loss and request deadlines both leave the scan RUNNING with a
    // durable cursor. Returning CONTINUED schedules the next slice (or the
    // 5-minute dispatcher fallback) instead of abandoning a frozen progress bar.
    const resumable =
      (error instanceof Error && error.message === SCAN_SLICE_LEASE_LOST) ||
      error instanceof GmailDeadlineError;
    if (resumable) {
      const saved = await store.updateScanRun(scanId, { ...durableProgress, status: "RUNNING" });
      if (!saved) return asFailedResult("INITIAL");
      const checkpoint = await store.getScanCheckpoint(scanId);
      const { threadCursor, threadsChecked, failedThreadIds, ...counters } = durableProgress;
      void threadCursor;
      void failedThreadIds;
      emitProductEvent({
        type: "scan.continued",
        scanId,
        connectionId,
        threadsChecked,
        threadsDiscovered: checkpoint?.discoveredThreadIds.length ?? 0,
        durationMs: Date.now() - startedMs,
      });
      return {
        scanId,
        status: "CONTINUED",
        counters,
        lookbackDays,
        mode: checkpoint?.discoveryMode ?? "INITIAL",
      };
    }
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
    const markedFailed = await store.updateScanRun(scanId, {
      status: "FAILED",
      finishedAt: new Date().toISOString(),
      errorCode,
      errorMessage: scanUserMessage(errorCode),
    });
    if (!markedFailed) {
      throw error;
    }
    await store.updateConnectionScan({
      connectionId,
      historyId: null,
      lastAttemptedScanAt: new Date().toISOString(),
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
