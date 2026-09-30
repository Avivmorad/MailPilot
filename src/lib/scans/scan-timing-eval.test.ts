import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ActionRecord } from "@/lib/actions/reconcile-action";
import type { EmailTriageProvider } from "@/lib/ai/analyze-thread";
import { threadAnalysisSchema, type ThreadAnalysis } from "@/lib/ai/schemas";
import type { MailPilotLogicalLabel } from "@/lib/gmail/constants";
import type { ParsedGmailMessage } from "@/lib/gmail/parser";
import { withGmailRequest } from "@/lib/gmail/request-budget";
import { asLookbackDays } from "@/lib/scans/checkpoint";
import { executeGmailScan, processInitialScan, resumeGmailScan } from "@/lib/scans/process-scan";
import {
  DEFAULT_TIMING_STAGE_COSTS,
  delay,
  emptyStageTimings,
  estimateScanTiming,
  expectedCriticalPathMs,
  type ScanStageCostsMs,
  type StageTimingAccumulator,
} from "@/lib/scans/scan-timing-eval";
import { mergePendingFailedThreadIds } from "@/lib/scans/thread-failures";
import type {
  ScanGmailPort,
  ScanSettings,
  ScanStorePort,
  StoredThreadRow,
} from "@/lib/scans/types";

function validAnalysis(overrides: Partial<ThreadAnalysis> = {}): ThreadAnalysis {
  return threadAnalysisSchema.parse({
    summary: "Budget approval",
    importance: "high",
    importance_reason: "budget",
    status: "action_required",
    requires_action: true,
    requires_reply: false,
    action_type: "approve",
    action_summary: "Approve budget",
    action_reason: "vendor",
    waiting_for: null,
    waiting_since: null,
    urgency: "soon",
    deadline: null,
    deadline_text: null,
    category: "other",
    sender_name: "Ada",
    organization: null,
    confidence: 0.88,
    short_display_title: "Budget",
    ...overrides,
  });
}

function parsedMessage(overrides: Partial<ParsedGmailMessage> = {}): ParsedGmailMessage {
  return {
    gmailMessageId: "m1",
    gmailThreadId: "t1",
    historyId: "100",
    internalDate: String(Date.parse("2026-09-10T10:00:00.000Z")),
    from: "Ada <ada@example.com>",
    to: "me@example.com",
    cc: null,
    bcc: null,
    subject: "Budget",
    messageIdHeader: "<m1@example.com>",
    inReplyTo: null,
    references: null,
    labelIds: ["INBOX"],
    snippet: "Please approve",
    plainText: "Please approve the budget.",
    hasAttachments: false,
    attachments: [],
    ...overrides,
  };
}

const LABEL_MAP = new Map<MailPilotLogicalLabel, string>([
  ["important", "L_IMP"],
  ["action_required", "L_ACT"],
  ["low_priority", "L_LOW"],
  ["processed", "L_PROC"],
]);

function createMemoryStore(): ScanStorePort & {
  threads: Map<string, StoredThreadRow & { gmailThreadId: string }>;
  scanRuns: Array<{
    id: string;
    status: string;
    startedAt: string;
    updatedAt?: string;
    connectionId?: string;
    userId?: string;
    lookbackDays?: number;
    discoveryComplete?: boolean;
    discoveredThreadIds?: string[];
    threadCursor?: number;
    historyBoundary?: string | null;
    failedThreadIds?: string[];
    messagesDiscovered?: number;
    messagesProcessed?: number;
    threadsAnalyzed?: number;
    importantCount?: number;
    actionCount?: number;
    replyCount?: number;
    waitingCount?: number;
    informationalCount?: number;
    ignoredCount?: number;
    discoveryMode?: string;
  }>;
  connection: {
    historyId: string | null;
    lastSuccessfulScanAt: string | null;
    lastAttemptedScanAt: string | null;
    nextScanAt: string | null;
    status: string;
  };
  getThreadCalls: number;
  getThreadsByGmailIdsCalls: number;
} {
  const threads = new Map<string, StoredThreadRow & { gmailThreadId: string }>();
  const messages = new Map<string, string>();
  const actions = new Map<string, ActionRecord>();
  const scanRuns: Array<{
    id: string;
    status: string;
    startedAt: string;
    updatedAt?: string;
    connectionId?: string;
    userId?: string;
    lookbackDays?: number;
    discoveryComplete?: boolean;
    discoveredThreadIds?: string[];
    threadCursor?: number;
    historyBoundary?: string | null;
    failedThreadIds?: string[];
    messagesDiscovered?: number;
    messagesProcessed?: number;
    threadsAnalyzed?: number;
    importantCount?: number;
    actionCount?: number;
    replyCount?: number;
    waitingCount?: number;
    informationalCount?: number;
    ignoredCount?: number;
    discoveryMode?: string;
  }> = [];
  const connection = {
    historyId: null as string | null,
    lastSuccessfulScanAt: null as string | null,
    lastAttemptedScanAt: null as string | null,
    nextScanAt: null as string | null,
    status: "CONNECTED",
  };
  const settings: ScanSettings = {
    vipSenders: [],
    ignoredSenders: [],
    ignoredDomains: [],
    customAiInstructions: "",
    timezone: "Asia/Jerusalem",
    dailyScanTime: "08:00",
  };
  let getThreadCalls = 0;
  let getThreadsByGmailIdsCalls = 0;

  const store: ReturnType<typeof createMemoryStore> = {
    threads,
    scanRuns,
    connection,
    get getThreadCalls() {
      return getThreadCalls;
    },
    get getThreadsByGmailIdsCalls() {
      return getThreadsByGmailIdsCalls;
    },
    async findRunningScan(connectionId) {
      const running = scanRuns.find(
        (run) => run.status === "RUNNING" && (run.connectionId ?? "conn-1") === connectionId,
      );
      return running
        ? {
            id: running.id,
            startedAt: running.startedAt,
            updatedAt: running.updatedAt ?? running.startedAt,
          }
        : null;
    },
    async getScanCheckpoint(scanId) {
      const run = scanRuns.find((item) => item.id === scanId);
      if (!run) return null;
      return {
        scanId: run.id,
        userId: run.userId ?? "user-1",
        connectionId: run.connectionId ?? "conn-1",
        lookbackDays: asLookbackDays(run.lookbackDays),
        triggerType: "MANUAL" as const,
        discoveryMode:
          run.discoveryMode === "INITIAL" ||
          run.discoveryMode === "INCREMENTAL" ||
          run.discoveryMode === "RECOVERY"
            ? run.discoveryMode
            : null,
        discoveryComplete: Boolean(run.discoveryComplete),
        discoveredThreadIds: run.discoveredThreadIds ?? [],
        threadCursor: run.threadCursor ?? 0,
        historyBoundary: run.historyBoundary ?? null,
        failedThreadIds: run.failedThreadIds ?? [],
        messagesDiscovered: run.messagesDiscovered ?? 0,
        messagesProcessed: run.messagesProcessed ?? 0,
        threadsAnalyzed: run.threadsAnalyzed ?? 0,
        importantCount: run.importantCount ?? 0,
        actionCount: run.actionCount ?? 0,
        replyCount: run.replyCount ?? 0,
        waitingCount: run.waitingCount ?? 0,
        informationalCount: run.informationalCount ?? 0,
        ignoredCount: run.ignoredCount ?? 0,
        startedAt: run.startedAt,
        updatedAt: run.updatedAt ?? run.startedAt,
      };
    },
    async getScanStatus(scanId) {
      const run = scanRuns.find((item) => item.id === scanId);
      if (
        run?.status === "RUNNING" ||
        run?.status === "SUCCESS" ||
        run?.status === "PARTIAL" ||
        run?.status === "FAILED"
      ) {
        return run.status;
      }
      return null;
    },
    async failScan(scanId, errorCode, errorMessage) {
      const run = scanRuns.find((item) => item.id === scanId);
      if (run && run.status === "RUNNING") {
        run.status = "FAILED";
        (run as { errorCode?: string }).errorCode = errorCode;
        (run as { errorMessage?: string }).errorMessage = errorMessage;
      }
    },
    async insertScanRun(input) {
      const id = crypto.randomUUID();
      const startedAt = new Date().toISOString();
      scanRuns.push({
        id,
        status: "RUNNING",
        startedAt,
        updatedAt: startedAt,
        connectionId: input.connectionId,
        userId: input.userId,
        lookbackDays: input.lookbackDays,
      });
      return id;
    },
    async updateScanRun(scanId, patch) {
      const run = scanRuns.find((item) => item.id === scanId);
      if (!run || run.status !== "RUNNING") return false;
      run.status = patch.status;
      run.updatedAt = new Date().toISOString();
      Object.assign(run, {
        ...(patch.threadsDiscovered !== undefined
          ? { threadsDiscovered: patch.threadsDiscovered }
          : {}),
        ...(patch.threadsChecked !== undefined ? { threadsChecked: patch.threadsChecked } : {}),
        ...(patch.lookbackDays !== undefined ? { lookbackDays: patch.lookbackDays } : {}),
        ...(patch.discoveryComplete !== undefined
          ? { discoveryComplete: patch.discoveryComplete }
          : {}),
        ...(patch.discoveredThreadIds !== undefined
          ? { discoveredThreadIds: patch.discoveredThreadIds }
          : {}),
        ...(patch.threadCursor !== undefined ? { threadCursor: patch.threadCursor } : {}),
        ...(patch.historyBoundary !== undefined ? { historyBoundary: patch.historyBoundary } : {}),
        ...(patch.failedThreadIds !== undefined ? { failedThreadIds: patch.failedThreadIds } : {}),
        ...(patch.messagesDiscovered !== undefined
          ? { messagesDiscovered: patch.messagesDiscovered }
          : {}),
        ...(patch.messagesProcessed !== undefined
          ? { messagesProcessed: patch.messagesProcessed }
          : {}),
        ...(patch.threadsAnalyzed !== undefined ? { threadsAnalyzed: patch.threadsAnalyzed } : {}),
        ...(patch.importantCount !== undefined ? { importantCount: patch.importantCount } : {}),
        ...(patch.actionCount !== undefined ? { actionCount: patch.actionCount } : {}),
        ...(patch.replyCount !== undefined ? { replyCount: patch.replyCount } : {}),
        ...(patch.waitingCount !== undefined ? { waitingCount: patch.waitingCount } : {}),
        ...(patch.informationalCount !== undefined
          ? { informationalCount: patch.informationalCount }
          : {}),
        ...(patch.ignoredCount !== undefined ? { ignoredCount: patch.ignoredCount } : {}),
        ...(patch.discoveryMode !== undefined ? { discoveryMode: patch.discoveryMode } : {}),
      });
      return true;
    },
    async getSettings() {
      return settings;
    },
    async getConnectionScanState() {
      return {
        historyId: connection.historyId,
        lastSuccessfulScanAt: connection.lastSuccessfulScanAt,
      };
    },
    async upsertThread(input) {
      const key = `${input.connectionId}:${input.gmailThreadId}`;
      const existing = threads.get(key);
      const id = existing?.id ?? crypto.randomUUID();
      threads.set(key, {
        id,
        gmailThreadId: input.gmailThreadId,
        lastAnalyzedMessageId: input.lastAnalyzedMessageId,
        analysisScanId: input.analysisScanId ?? null,
        promptVersion: input.promptVersion,
        analysis: input.analysis,
      });
      return id;
    },
    async getThread(connectionId, gmailThreadId) {
      getThreadCalls += 1;
      return threads.get(`${connectionId}:${gmailThreadId}`) ?? null;
    },
    async getThreadsByGmailIds(connectionId, gmailThreadIds) {
      getThreadsByGmailIdsCalls += 1;
      const result = new Map<string, StoredThreadRow>();
      for (const gmailThreadId of gmailThreadIds) {
        const row = threads.get(`${connectionId}:${gmailThreadId}`);
        if (row) result.set(gmailThreadId, row);
      }
      return result;
    },
    async upsertMessage(input) {
      messages.set(`${input.connectionId}:${input.message.gmailMessageId}`, input.threadId);
    },
    async getAction(threadId) {
      return actions.get(threadId) ?? null;
    },
    async upsertAction(_userId, threadId, action) {
      actions.set(threadId, action);
    },
    async updateConnectionScan(input) {
      if (input.historyId !== undefined) connection.historyId = input.historyId;
      connection.lastAttemptedScanAt = input.lastAttemptedScanAt;
      if (input.lastSuccessfulScanAt !== undefined) {
        connection.lastSuccessfulScanAt = input.lastSuccessfulScanAt;
      }
      if (input.nextScanAt !== undefined) connection.nextScanAt = input.nextScanAt;
    },
    async listPendingFailedThreadIds(connectionId, excludeScanId) {
      const partials = scanRuns.filter(
        (run) =>
          run.id !== excludeScanId &&
          run.status === "PARTIAL" &&
          (run.connectionId ?? "conn-1") === connectionId,
      );
      return mergePendingFailedThreadIds(
        partials.map((run) => ({
          failedThreadIds: run.failedThreadIds ?? [],
          errorMessage: (run as { errorMessage?: string }).errorMessage,
        })),
      );
    },
    async markConnectionReauthRequired() {
      connection.status = "REAUTH_REQUIRED";
    },
  };
  return store;
}

function unusedProvider(): EmailTriageProvider {
  return {
    analyzeThread: async () => {
      throw new Error("provider should not be used when analyze is injected");
    },
  };
}

async function runTimedScan(options: {
  threadCount: number;
  concurrency: number;
  costs: ScanStageCostsMs;
  stages: StageTimingAccumulator;
  store?: ReturnType<typeof createMemoryStore>;
  analyze?: Parameters<typeof processInitialScan>[0]["analyze"];
  seedReuse?: boolean;
}) {
  const store = options.store ?? createMemoryStore();
  const threadIds = Array.from({ length: options.threadCount }, (_, i) => `t${i + 1}`);
  const refs = threadIds.map((threadId) => ({ id: `m-${threadId}`, threadId }));

  if (options.seedReuse) {
    for (const threadId of threadIds) {
      await store.upsertThread({
        userId: "user-1",
        connectionId: "conn-1",
        gmailThreadId: threadId,
        subject: "Budget",
        participants: [{ email: "ada@example.com", name: "Ada" }],
        latestMessageAt: "2026-09-10T10:00:00.000Z",
        latestMessageDirection: "INBOUND",
        analysis: validAnalysis(),
        lastAnalyzedMessageId: `m-${threadId}`,
        promptVersion: null,
        modelName: "synthetic",
        analysisScanId: "prior-scan",
      });
      // promptVersion filled after first scan via analysisPromptKey; seed by running once below when needed
    }
  }

  const gmail: ScanGmailPort = {
    // No slice deadline so fake-timer advances do not trip SCAN_WORK_BUDGET_MS mid-eval.
    requestBudget: {},
    getProfileHistoryId: async () => "hist-timing",
    listMessageRefs: async () => refs,
    listHistoryChanges: async () => ({ ok: true, refs: [], latestHistoryId: "hist-timing" }),
    loadLabelMap: async () => LABEL_MAP,
    fetchThread: async (threadId) => {
      const started = Date.now();
      await delay(options.costs.fetchMs);
      options.stages.fetchMs += Date.now() - started;
      options.stages.fetchCalls += 1;
      return [
        parsedMessage({
          gmailThreadId: threadId,
          gmailMessageId: `m-${threadId}`,
          messageIdHeader: `<${threadId}@example.com>`,
        }),
      ];
    },
    modifyThreadLabels: async () => {
      const started = Date.now();
      await delay(options.costs.labelMs);
      options.stages.labelMs += Date.now() - started;
      options.stages.labelCalls += 1;
    },
  };

  let inFlightAi = 0;
  let maxInFlightAi = 0;
  const analyze: NonNullable<Parameters<typeof processInitialScan>[0]["analyze"]> =
    options.analyze ??
    (async () => {
      inFlightAi += 1;
      maxInFlightAi = Math.max(maxInFlightAi, inFlightAi);
      const started = Date.now();
      try {
        await delay(options.costs.aiMs);
        options.stages.aiMs += Date.now() - started;
        options.stages.aiCalls += 1;
        return { ok: true as const, analysis: validAnalysis() };
      } finally {
        inFlightAi -= 1;
      }
    });

  const originalUpsert = store.upsertMessage.bind(store);
  store.upsertMessage = async (input) => {
    const started = Date.now();
    await delay(options.costs.persistMs);
    options.stages.persistMs += Date.now() - started;
    options.stages.persistCalls += 1;
    return originalUpsert(input);
  };

  const originalUpdate = store.updateScanRun.bind(store);
  store.updateScanRun = async (scanId, patch) => {
    // Durable wave checkpoint only. The final SUCCESS/PARTIAL write is not on
    // the per-wave critical path modeled by expectedCriticalPathMs.
    const waveCheckpoint =
      patch.status === "RUNNING" &&
      patch.threadCursor !== undefined &&
      patch.failedThreadIds !== undefined &&
      patch.discoveryComplete === true &&
      patch.messagesProcessed !== undefined;
    if (waveCheckpoint) {
      const started = Date.now();
      await delay(options.costs.checkpointMs);
      options.stages.checkpointMs += Date.now() - started;
      options.stages.checkpointCalls += 1;
    }
    return originalUpdate(scanId, patch);
  };

  vi.stubEnv("AI_MAX_CONCURRENCY", String(options.concurrency));
  const startedMs = Date.now();
  const resultPromise = processInitialScan({
    userId: "user-1",
    connectionId: "conn-1",
    gmailEmail: "me@example.com",
    lookbackDays: 7,
    now: new Date("2026-09-10T12:00:00.000Z"),
    gmail,
    store,
    provider: unusedProvider(),
    modelName: "synthetic-timing",
    analyze,
  });
  const estimate = estimateScanTiming(options.threadCount, options.concurrency, options.costs);
  // Advance exactly the modeled critical path so Date.now() matches wall cost
  // (extra buffer would inflate elapsedMs even after the scan finished).
  await vi.advanceTimersByTimeAsync(estimate.expectedCriticalPathMs);
  const result = await resultPromise;
  const elapsedMs = Date.now() - startedMs;
  return {
    result,
    elapsedMs,
    estimate,
    store,
    analyze,
    stages: options.stages,
    maxInFlightAi,
  };
}

describe("scan timing model", () => {
  it("estimates 700-thread critical path as ceil(700 / concurrency) * per-thread cost", () => {
    const costs = DEFAULT_TIMING_STAGE_COSTS;
    const concurrency = 4;
    const estimate = estimateScanTiming(700, concurrency, costs);
    expect(estimate.waveCount).toBe(175);
    expect(estimate.perThreadCriticalPathMs).toBe(120);
    expect(estimate.expectedCriticalPathMs).toBe(175 * 120);
    expect(estimate.expectedCriticalPathMs).toBe(expectedCriticalPathMs(700, concurrency, costs));
    expect(estimate.expectedCriticalPathMs).toBeLessThan(estimate.sequentialAiOnlyMs);
    expect(estimate.sequentialAiOnlyMs).toBe(700 * costs.aiMs);
  });
});

describe("scan timing eval (fake timers)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-10T12:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
  });

  it("overlaps AI work up to AI_MAX_CONCURRENCY on a multi-thread wave", async () => {
    const costs: ScanStageCostsMs = {
      fetchMs: 10,
      aiMs: 100,
      persistMs: 5,
      labelMs: 5,
      checkpointMs: 10,
    };
    const stages = emptyStageTimings();
    const { result, elapsedMs, estimate, maxInFlightAi, store } = await runTimedScan({
      threadCount: 8,
      concurrency: 4,
      costs,
      stages,
    });
    expect(result.status).toBe("SUCCESS");
    expect(estimate.waveCount).toBe(2);
    expect(estimate.perThreadCriticalPathMs).toBe(120);
    expect(estimate.expectedCriticalPathMs).toBe(2 * (120 + 10));
    expect(elapsedMs).toBe(estimate.expectedCriticalPathMs);
    expect(maxInFlightAi).toBe(4);
    expect(stages.aiCalls).toBe(8);
    expect(stages.checkpointCalls).toBe(2);
    expect(store.getThreadsByGmailIdsCalls).toBe(2);
    expect(store.getThreadCalls).toBe(0);
    // Sum of per-call AI time is 800ms; wall clock is two overlapped waves.
    expect(stages.aiMs).toBe(800);
    expect(elapsedMs).toBeLessThan(stages.aiMs);
  });

  it("matches ceil(700 / 4) * per-thread cost for a 700-thread fake scan", async () => {
    const costs = DEFAULT_TIMING_STAGE_COSTS;
    const stages = emptyStageTimings();
    const {
      result,
      elapsedMs,
      estimate,
      stages: recorded,
      store,
      maxInFlightAi,
    } = await runTimedScan({
      threadCount: 700,
      concurrency: 4,
      costs,
      stages,
    });
    expect(result.status).toBe("SUCCESS");
    expect(result.counters.threadsAnalyzed).toBe(700);
    expect(estimate.waveCount).toBe(175);
    expect(estimate.expectedCriticalPathMs).toBe(21_000);
    expect(elapsedMs).toBe(estimate.expectedCriticalPathMs);
    expect(maxInFlightAi).toBe(4);
    expect(store.getThreadsByGmailIdsCalls).toBe(175);
    expect(store.getThreadCalls).toBe(0);
    expect(recorded.fetchCalls).toBe(700);
    expect(recorded.aiCalls).toBe(700);
    expect(recorded.labelCalls).toBe(700);
    expect(recorded.persistCalls).toBe(700);
    expect(recorded.checkpointCalls).toBe(175);
    // Stage sums show AI dominates simulated work units; wall clock is overlapped.
    expect(recorded.aiMs).toBe(700 * costs.aiMs);
    expect(recorded.fetchMs).toBe(700 * costs.fetchMs);
    expect(recorded.persistMs).toBe(700 * costs.persistMs);
    expect(recorded.labelMs).toBe(700 * costs.labelMs);
    expect(elapsedMs).toBeLessThan(recorded.aiMs);
    expect(elapsedMs).toBeLessThan(700 * costs.aiMs);
  });

  it("does not re-AI unchanged threads when a continued scan resumes after a checkpoint", async () => {
    const store = createMemoryStore();
    const analyze = vi.fn(async () => ({ ok: true as const, analysis: validAnalysis() }));
    vi.stubEnv("AI_MAX_CONCURRENCY", "1");

    const budget = { deadlineAt: Date.now() + 50 };
    const refs = [
      { id: "m-t1", threadId: "t1" },
      { id: "m-t2", threadId: "t2" },
      { id: "m-t3", threadId: "t3" },
    ];
    const gmail: ScanGmailPort = {
      requestBudget: budget,
      getProfileHistoryId: async () => "hist-1",
      listMessageRefs: async () => refs,
      listHistoryChanges: async () => ({ ok: true, refs: [], latestHistoryId: "hist-1" }),
      loadLabelMap: async () => LABEL_MAP,
      fetchThread: (threadId) => {
        if (threadId === "t2") {
          // Hang past the slice deadline so the first durable wave checkpoints t1 only.
          return withGmailRequest(() => new Promise<never>(() => undefined), budget);
        }
        return Promise.resolve([
          parsedMessage({ gmailThreadId: threadId, gmailMessageId: `m-${threadId}` }),
        ]);
      },
      modifyThreadLabels: async () => undefined,
    };

    const firstPromise = processInitialScan({
      userId: "user-1",
      connectionId: "conn-1",
      gmailEmail: "me@example.com",
      lookbackDays: 7,
      now: new Date("2026-09-10T12:00:00.000Z"),
      gmail,
      store,
      provider: unusedProvider(),
      modelName: "synthetic-timing",
      analyze,
    });
    await vi.advanceTimersByTimeAsync(50);
    const first = await firstPromise;
    expect(first.status).toBe("CONTINUED");
    expect(store.scanRuns[0]?.threadCursor).toBe(1);
    expect(analyze).toHaveBeenCalledTimes(1);

    const resumeAnalyze = vi.fn(async () => ({ ok: true as const, analysis: validAnalysis() }));
    const resumed = await resumeGmailScan({
      scanId: store.scanRuns[0]!.id,
      gmailEmail: "me@example.com",
      store,
      gmail: {
        ...gmail,
        requestBudget: {},
        fetchThread: async (threadId) => [
          parsedMessage({ gmailThreadId: threadId, gmailMessageId: `m-${threadId}` }),
        ],
      },
      provider: unusedProvider(),
      modelName: "synthetic-timing",
      analyze: resumeAnalyze,
    });
    const secondPromise = executeGmailScan(resumed);
    await vi.advanceTimersByTimeAsync(10);
    const second = await secondPromise;
    expect(second.status).toBe("SUCCESS");
    // Completed prefix (t1) is not re-analyzed; only remaining threads call AI.
    expect(resumeAnalyze).toHaveBeenCalledTimes(2);
    expect(store.scanRuns[0]?.threadCursor).toBe(3);
  });

  it("skips AI on a follow-up lookback when stored analysis matches the latest message", async () => {
    const costs: ScanStageCostsMs = {
      fetchMs: 0,
      aiMs: 50,
      persistMs: 0,
      labelMs: 0,
      checkpointMs: 0,
    };
    const stages = emptyStageTimings();
    const first = await runTimedScan({
      threadCount: 4,
      concurrency: 2,
      costs,
      stages,
    });
    expect(first.result.status).toBe("SUCCESS");
    expect(stages.aiCalls).toBe(4);

    const reuseStages = emptyStageTimings();
    const analyze = vi.fn(async () => {
      reuseStages.aiCalls += 1;
      await delay(costs.aiMs);
      return { ok: true as const, analysis: validAnalysis() };
    });
    // Force lookback so discovery re-lists the same threads with unchanged latest ids.
    vi.stubEnv("AI_MAX_CONCURRENCY", "2");
    const store = first.store;
    store.connection.historyId = null;
    store.connection.lastSuccessfulScanAt = null;
    const refs = Array.from({ length: 4 }, (_, i) => {
      const threadId = `t${i + 1}`;
      return { id: `m-${threadId}`, threadId };
    });
    const gmail: ScanGmailPort = {
      requestBudget: {},
      getProfileHistoryId: async () => "hist-2",
      listMessageRefs: async () => refs,
      listHistoryChanges: async () => ({ ok: true, refs: [], latestHistoryId: "hist-2" }),
      loadLabelMap: async () => LABEL_MAP,
      fetchThread: async (threadId) => [
        parsedMessage({ gmailThreadId: threadId, gmailMessageId: `m-${threadId}` }),
      ],
      modifyThreadLabels: async () => undefined,
    };
    const secondPromise = processInitialScan({
      userId: "user-1",
      connectionId: "conn-1",
      gmailEmail: "me@example.com",
      lookbackDays: 7,
      forceLookback: true,
      now: new Date("2026-09-10T13:00:00.000Z"),
      gmail,
      store,
      provider: unusedProvider(),
      modelName: "synthetic-timing",
      analyze,
    });
    await vi.advanceTimersByTimeAsync(200);
    const second = await secondPromise;
    expect(second.status).toBe("SUCCESS");
    expect(analyze).not.toHaveBeenCalled();
    expect(reuseStages.aiCalls).toBe(0);
  });
});
