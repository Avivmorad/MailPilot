import { describe, expect, it, vi } from "vitest";

import type { ActionRecord } from "@/lib/actions/reconcile-action";
import type { EmailTriageProvider } from "@/lib/ai/analyze-thread";
import { TRIAGE_PROMPT_VERSION } from "@/lib/ai/prompts";
import { threadAnalysisSchema, type ThreadAnalysis } from "@/lib/ai/schemas";
import type { MailPilotLogicalLabel } from "@/lib/gmail/constants";
import type { ParsedGmailMessage } from "@/lib/gmail/parser";
import { asLookbackDays } from "@/lib/scans/checkpoint";
import type { InitialLookbackDays } from "@/lib/scans/lookback";
import {
  analysisPromptKey,
  executeGmailScan,
  SCAN_WORK_BUDGET_MS,
  openGmailScan,
  processInitialScan,
  resumeGmailScan,
  shouldReuseStoredAnalysis,
} from "@/lib/scans/process-scan";
import { parseThreadFailureIds } from "@/lib/scans/thread-failures";
import type {
  ScanGmailPort,
  ScanSettings,
  ScanStorePort,
  StoredThreadRow,
} from "@/lib/scans/types";

function validAnalysis(overrides: Partial<ThreadAnalysis> = {}): ThreadAnalysis {
  return threadAnalysisSchema.parse({
    summary: "בקשה לאשר תקציב",
    importance: "high",
    importance_reason: "budget approval",
    status: "action_required",
    requires_action: true,
    requires_reply: false,
    action_type: "approve",
    action_summary: "אשר את התקציב",
    action_reason: "vendor contracts",
    waiting_for: null,
    waiting_since: null,
    urgency: "soon",
    deadline: null,
    deadline_text: null,
    category: "other",
    sender_name: "Ada",
    organization: null,
    confidence: 0.88,
    short_display_title: "אישור תקציב",
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
  threads: Map<string, StoredThreadRow & { gmailThreadId: string; subject: string | null }>;
  messages: Map<string, string>;
  actions: Map<string, ActionRecord>;
  connection: {
    lastSuccessfulScanAt: string | null;
    lastAttemptedScanAt: string | null;
    historyId: string | null;
    status: string;
  };
  scanRuns: Array<{
    id: string;
    status: string;
    startedAt: string;
    updatedAt?: string;
    connectionId?: string;
    errorCode?: string | null;
    errorMessage?: string | null;
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
    userId?: string;
  }>;
  progressChecks: number[];
} {
  const threads = new Map<
    string,
    StoredThreadRow & { gmailThreadId: string; subject: string | null }
  >();
  const messages = new Map<string, string>();
  const actions = new Map<string, ActionRecord>();
  const scanRuns: Array<{
    id: string;
    status: string;
    startedAt: string;
    updatedAt?: string;
    threadsDiscovered?: number;
    threadsChecked?: number;
    connectionId?: string;
    errorCode?: string | null;
    errorMessage?: string | null;
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
    userId?: string;
  }> = [];
  const progressChecks: number[] = [];
  const connection = {
    lastSuccessfulScanAt: null as string | null,
    lastAttemptedScanAt: null as string | null,
    historyId: null as string | null,
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

  const store: ScanStorePort & {
    threads: typeof threads;
    messages: typeof messages;
    actions: typeof actions;
    connection: typeof connection;
    scanRuns: typeof scanRuns;
    progressChecks: number[];
  } = {
    threads,
    messages,
    actions,
    connection,
    scanRuns,
    progressChecks,
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
      if (!run) {
        return null;
      }
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
    async failScan(scanId) {
      const run = scanRuns.find((item) => item.id === scanId);
      if (run) {
        run.status = "FAILED";
      }
    },
    async insertScanRun(input) {
      if (
        scanRuns.some((run) => run.status === "RUNNING" && run.connectionId === input.connectionId)
      ) {
        throw new Error("SCAN_IN_PROGRESS");
      }
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
      if (run) {
        run.status = patch.status;
        run.updatedAt = new Date().toISOString();
        if (patch.threadsDiscovered !== undefined) {
          run.threadsDiscovered = patch.threadsDiscovered;
        }
        if (patch.threadsChecked !== undefined) {
          run.threadsChecked = patch.threadsChecked;
          progressChecks.push(patch.threadsChecked);
        }
        if (patch.errorCode !== undefined) {
          run.errorCode = patch.errorCode;
        }
        if (patch.errorMessage !== undefined) {
          run.errorMessage = patch.errorMessage;
        }
        if (patch.lookbackDays !== undefined) {
          run.lookbackDays = patch.lookbackDays;
        }
        if (patch.discoveryComplete !== undefined) {
          run.discoveryComplete = patch.discoveryComplete;
        }
        if (patch.discoveredThreadIds !== undefined) {
          run.discoveredThreadIds = patch.discoveredThreadIds;
        }
        if (patch.threadCursor !== undefined) {
          run.threadCursor = patch.threadCursor;
        }
        if (patch.historyBoundary !== undefined) {
          run.historyBoundary = patch.historyBoundary;
        }
        if (patch.failedThreadIds !== undefined) {
          run.failedThreadIds = patch.failedThreadIds;
        }
        if (patch.messagesDiscovered !== undefined) {
          run.messagesDiscovered = patch.messagesDiscovered;
        }
        if (patch.messagesProcessed !== undefined) {
          run.messagesProcessed = patch.messagesProcessed;
        }
        if (patch.threadsAnalyzed !== undefined) {
          run.threadsAnalyzed = patch.threadsAnalyzed;
        }
        if (patch.importantCount !== undefined) {
          run.importantCount = patch.importantCount;
        }
        if (patch.discoveryMode !== undefined) {
          run.discoveryMode = patch.discoveryMode;
        }
      }
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
        subject: input.subject,
        lastAnalyzedMessageId: input.lastAnalyzedMessageId,
        promptVersion: input.promptVersion,
        analysis: input.analysis,
      });
      return id;
    },
    async getThread(connectionId, gmailThreadId) {
      return threads.get(`${connectionId}:${gmailThreadId}`) ?? null;
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
      if (input.historyId) {
        connection.historyId = input.historyId;
      }
      connection.lastAttemptedScanAt = input.lastAttemptedScanAt;
      if (input.lastSuccessfulScanAt !== undefined) {
        connection.lastSuccessfulScanAt = input.lastSuccessfulScanAt;
      }
    },
    async listPendingFailedThreadIds(connectionId, excludeScanId) {
      const latest = [...scanRuns]
        .reverse()
        .find(
          (run) =>
            run.id !== excludeScanId &&
            run.status === "PARTIAL" &&
            (run.connectionId ?? "conn-1") === connectionId,
        );
      return parseThreadFailureIds(latest?.errorMessage);
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

async function runScan(options: {
  store: ReturnType<typeof createMemoryStore>;
  gmail: ScanGmailPort;
  analyze?: Parameters<typeof processInitialScan>[0]["analyze"];
  lookbackDays?: InitialLookbackDays;
  now?: Date;
}) {
  return processInitialScan({
    userId: "user-1",
    connectionId: "conn-1",
    gmailEmail: "me@example.com",
    lookbackDays: options.lookbackDays ?? 7,
    now: options.now ?? new Date("2026-09-10T12:00:00.000Z"),
    gmail: options.gmail,
    store: options.store,
    provider: unusedProvider(),
    modelName: "gemini-test",
    analyze: options.analyze,
  });
}

describe("processInitialScan", () => {
  it("stops admitting work at the budget and preserves the cursor for retry", async () => {
    const store = createMemoryStore();
    store.connection.historyId = "old-history";
    store.connection.lastSuccessfulScanAt = "2026-09-09T12:00:00.000Z";
    const clock = vi.spyOn(Date, "now").mockReturnValue(0);
    const fetchThread = vi.fn(async () => [parsedMessage()]);
    try {
      const result = await runScan({
        store,
        gmail: {
          getProfileHistoryId: async () => "new-history",
          listHistoryChanges: async () => {
            clock.mockReturnValue(SCAN_WORK_BUDGET_MS);
            return {
              ok: true,
              refs: [{ id: "m1", threadId: "t1" }],
              latestHistoryId: "new-history",
            };
          },
          listMessageRefs: async () => [],
          fetchThread,
          loadLabelMap: async () => LABEL_MAP,
          modifyThreadLabels: async () => {},
        },
      });
      expect(result.status).toBe("CONTINUED");
      expect(fetchThread).not.toHaveBeenCalled();
      expect(store.connection.historyId).toBe("old-history");
      expect(store.scanRuns[0].status).toBe("RUNNING");
      expect(store.scanRuns[0].threadCursor).toBe(0);
      expect(store.scanRuns[0].discoveredThreadIds).toEqual(["t1"]);
    } finally {
      clock.mockRestore();
    }
  });

  it("resumes remaining threads on the next invocation without re-analyzing finished ones", async () => {
    vi.stubEnv("AI_MAX_CONCURRENCY", "1");
    const store = createMemoryStore();
    const clock = vi.spyOn(Date, "now").mockReturnValue(0);
    const analyze = vi.fn(async () => ({ ok: true as const, analysis: validAnalysis() }));
    const fetchThread = vi.fn(async (threadId: string) => [
      parsedMessage({ gmailThreadId: threadId, gmailMessageId: `m-${threadId}` }),
    ]);
    const gmail: ScanGmailPort = {
      getProfileHistoryId: async () => "hist-new",
      listHistoryChanges: async () => {
        throw new Error("history should not run on the initial scan");
      },
      listMessageRefs: async () => [
        { id: "m-t1", threadId: "t1" },
        { id: "m-t2", threadId: "t2" },
      ],
      fetchThread,
      loadLabelMap: async () => LABEL_MAP,
      modifyThreadLabels: async () => {},
    };
    try {
      fetchThread.mockImplementation(async (threadId: string) => {
        clock.mockReturnValue(SCAN_WORK_BUDGET_MS);
        return [parsedMessage({ gmailThreadId: threadId, gmailMessageId: `m-${threadId}` })];
      });
      const first = await runScan({ store, gmail, analyze });
      expect(first.status).toBe("CONTINUED");
      expect(analyze).toHaveBeenCalledTimes(1);
      expect(store.scanRuns[0]?.threadCursor).toBe(1);
      expect(store.connection.historyId).toBeNull();

      clock.mockReturnValue(0);
      const prepared = await resumeGmailScan({
        scanId: first.scanId,
        gmailEmail: "me@example.com",
        gmail,
        store,
        provider: unusedProvider(),
        modelName: "gemini-test",
        analyze,
      });
      fetchThread.mockImplementation(async (threadId: string) => [
        parsedMessage({ gmailThreadId: threadId, gmailMessageId: `m-${threadId}` }),
      ]);
      const second = await executeGmailScan(prepared);
      expect(second.status).toBe("SUCCESS");
      expect(analyze).toHaveBeenCalledTimes(2);
      expect(store.scanRuns[0]?.status).toBe("SUCCESS");
      expect(store.connection.historyId).toBe("hist-new");
    } finally {
      clock.mockRestore();
      vi.unstubAllEnvs();
    }
  });

  it("upserts a thread once, applies labels after analysis, and keeps counters consistent", async () => {
    const store = createMemoryStore();
    const modifyThreadLabels = vi.fn(async () => undefined);
    const message = parsedMessage();
    const analysis = validAnalysis();
    const analyze = vi.fn(async () => ({ ok: true as const, analysis }));

    const gmail: ScanGmailPort = {
      listMessageRefs: async (query) => {
        expect(query).toBe("-in:spam -in:trash newer_than:7d");
        return [{ id: message.gmailMessageId, threadId: message.gmailThreadId }];
      },
      listHistoryChanges: async () => {
        throw new Error("history should not run on the initial scan");
      },
      fetchThread: async () => [message],
      getProfileHistoryId: async () => "hist-1",
      loadLabelMap: async () => LABEL_MAP,
      modifyThreadLabels,
    };

    const first = await runScan({ store, gmail, analyze });
    expect(first.status).toBe("SUCCESS");
    expect(first.mode).toBe("INITIAL");
    expect(first.counters.threadsAnalyzed).toBe(1);
    expect(first.counters.messagesProcessed).toBe(1);
    expect(first.counters.importantCount).toBe(1);
    expect(first.counters.actionCount).toBe(1);
    expect(store.threads.size).toBe(1);
    expect(store.messages.size).toBe(1);
    expect(store.actions.size).toBe(1);
    expect(modifyThreadLabels).toHaveBeenCalledWith("t1", ["L_IMP", "L_ACT", "L_PROC"], []);

    const fetchThread = vi.fn(async () => [message]);
    const incrementalGmail: ScanGmailPort = {
      listMessageRefs: async () => {
        throw new Error("incremental scan must not list the lookback window");
      },
      listHistoryChanges: async (startHistoryId) => {
        expect(startHistoryId).toBe("hist-1");
        return { ok: true, refs: [], latestHistoryId: "hist-2" };
      },
      fetchThread,
      getProfileHistoryId: async () => "hist-2",
      loadLabelMap: async () => LABEL_MAP,
      modifyThreadLabels,
    };

    const second = await runScan({ store, gmail: incrementalGmail, analyze });
    expect(second.status).toBe("SUCCESS");
    expect(second.mode).toBe("INCREMENTAL");
    expect(second.counters.threadsAnalyzed).toBe(0);
    expect(second.counters.messagesDiscovered).toBe(0);
    expect(store.threads.size).toBe(1);
    expect(store.messages.size).toBe(1);
    expect(analyze).toHaveBeenCalledTimes(1);
    expect(fetchThread).not.toHaveBeenCalled();
    expect(modifyThreadLabels).toHaveBeenCalledTimes(1);
  });

  it("does not apply Gmail labels when AI analysis fails", async () => {
    const store = createMemoryStore();
    const modifyThreadLabels = vi.fn(async () => undefined);
    const message = parsedMessage();
    const gmail: ScanGmailPort = {
      listMessageRefs: async () => [
        { id: message.gmailMessageId, threadId: message.gmailThreadId },
      ],
      listHistoryChanges: async () => {
        throw new Error("history should not run on the initial scan");
      },
      fetchThread: async () => [message],
      getProfileHistoryId: async () => "hist-1",
      loadLabelMap: async () => LABEL_MAP,
      modifyThreadLabels,
    };

    const result = await runScan({
      store,
      gmail,
      analyze: async () => ({ ok: false, error: new Error("gemini down") }),
    });

    expect(result.status).toBe("PARTIAL");
    expect(result.counters.threadsAnalyzed).toBe(0);
    expect(modifyThreadLabels).not.toHaveBeenCalled();
    expect(store.actions.size).toBe(0);
    expect([...store.threads.values()][0]?.analysis).toBeNull();
    expect(store.connection.historyId).toBeNull();
    expect(store.connection.lastSuccessfulScanAt).toBeNull();
    expect(store.scanRuns.at(-1)?.errorCode).toBe("partial_thread_failures");
    expect(store.scanRuns.at(-1)?.errorMessage).toBe("thread_failures:1:t1");
  });

  it("does not bump prompt_version when reanalysis fails", async () => {
    const store = createMemoryStore();
    const message = parsedMessage();
    await store.upsertThread({
      userId: "user-1",
      connectionId: "conn-1",
      gmailThreadId: message.gmailThreadId,
      subject: message.subject,
      participants: [],
      latestMessageAt: "2026-09-10T10:00:00.000Z",
      latestMessageDirection: "INBOUND",
      analysis: validAnalysis(),
      lastAnalyzedMessageId: "old-message",
      promptVersion: "mailpilot-triage-v8",
      modelName: "gemini-test",
    });
    const gmail: ScanGmailPort = {
      listMessageRefs: async () => [
        { id: message.gmailMessageId, threadId: message.gmailThreadId },
      ],
      listHistoryChanges: async () => {
        throw new Error("history should not run on the initial scan");
      },
      fetchThread: async () => [message],
      getProfileHistoryId: async () => "hist-1",
      loadLabelMap: async () => LABEL_MAP,
      modifyThreadLabels: async () => undefined,
    };

    await runScan({
      store,
      gmail,
      analyze: async () => ({ ok: false, error: new Error("gemini down") }),
    });

    expect([...store.threads.values()][0]?.promptVersion).toBe("mailpilot-triage-v8");
  });

  it("does not advance the Gmail history checkpoint after a partial incremental scan", async () => {
    const store = createMemoryStore();
    store.connection.historyId = "hist-1";
    store.connection.lastSuccessfulScanAt = "2026-09-10T08:00:00.000Z";
    const failed = parsedMessage({ gmailMessageId: "m-fail", gmailThreadId: "t-fail" });
    let profileReads = 0;
    const gmail: ScanGmailPort = {
      listMessageRefs: async () => {
        throw new Error("incremental scan must not list the lookback window");
      },
      listHistoryChanges: async (startHistoryId) => {
        expect(startHistoryId).toBe("hist-1");
        return {
          ok: true,
          refs: [{ id: failed.gmailMessageId, threadId: failed.gmailThreadId }],
          latestHistoryId: "hist-9",
        };
      },
      fetchThread: async () => [failed],
      getProfileHistoryId: async () => {
        profileReads += 1;
        return profileReads === 1 ? "hist-boundary" : "hist-should-not-persist";
      },
      loadLabelMap: async () => LABEL_MAP,
      modifyThreadLabels: async () => undefined,
    };

    const result = await runScan({
      store,
      gmail,
      analyze: async () => ({ ok: false, error: new Error("gemini down") }),
    });

    expect(result.status).toBe("PARTIAL");
    expect(result.mode).toBe("INCREMENTAL");
    expect(store.connection.historyId).toBe("hist-1");
    expect(store.connection.lastSuccessfulScanAt).toBe("2026-09-10T08:00:00.000Z");
    expect(store.connection.lastAttemptedScanAt).toBeTruthy();
  });

  it("retries thread ids recorded on the previous partial scan even when history is empty", async () => {
    const store = createMemoryStore();
    store.connection.historyId = "hist-1";
    store.connection.lastSuccessfulScanAt = "2026-09-10T08:00:00.000Z";
    store.scanRuns.push({
      id: "prev-partial",
      status: "PARTIAL",
      startedAt: "2026-09-11T08:00:00.000Z",
      connectionId: "conn-1",
      errorCode: "partial_thread_failures",
      errorMessage: "thread_failures:1:t-fail",
    });
    const failed = parsedMessage({ gmailMessageId: "m-fail", gmailThreadId: "t-fail" });
    const fetchThread = vi.fn(async () => [failed]);
    const gmail: ScanGmailPort = {
      listMessageRefs: async () => {
        throw new Error("incremental scan must not list the lookback window");
      },
      listHistoryChanges: async () => ({ ok: true, refs: [], latestHistoryId: "hist-2" }),
      fetchThread,
      getProfileHistoryId: async () => "hist-2",
      loadLabelMap: async () => LABEL_MAP,
      modifyThreadLabels: async () => undefined,
    };

    const result = await runScan({
      store,
      gmail,
      analyze: async () => ({ ok: true as const, analysis: validAnalysis() }),
    });

    expect(result.status).toBe("SUCCESS");
    expect(fetchThread).toHaveBeenCalledWith("t-fail");
    expect(result.counters.threadsAnalyzed).toBe(1);
    expect(store.connection.historyId).toBe("hist-2");
  });

  it("persists the history boundary captured before processing, not a later profile id", async () => {
    const store = createMemoryStore();
    const message = parsedMessage();
    let profileReads = 0;
    const gmail: ScanGmailPort = {
      listMessageRefs: async () => [
        { id: message.gmailMessageId, threadId: message.gmailThreadId },
      ],
      listHistoryChanges: async () => {
        throw new Error("history should not run on the initial scan");
      },
      fetchThread: async () => [message],
      getProfileHistoryId: async () => {
        profileReads += 1;
        return profileReads === 1 ? "hist-before" : "hist-after";
      },
      loadLabelMap: async () => LABEL_MAP,
      modifyThreadLabels: async () => undefined,
    };

    const result = await runScan({
      store,
      gmail,
      analyze: async () => ({ ok: true as const, analysis: validAnalysis() }),
    });

    expect(result.status).toBe("SUCCESS");
    expect(store.connection.historyId).toBe("hist-before");
    expect(profileReads).toBe(1);
  });

  it("marks REAUTH_REQUIRED when Gmail returns 401 mid-scan", async () => {
    const store = createMemoryStore();
    const message = parsedMessage();
    const modifyThreadLabels = vi.fn(async () => undefined);
    const gmail: ScanGmailPort = {
      listMessageRefs: async () => [
        { id: message.gmailMessageId, threadId: message.gmailThreadId },
      ],
      listHistoryChanges: async () => {
        throw new Error("history should not run on the initial scan");
      },
      fetchThread: async () => {
        throw { response: { status: 401 }, message: "invalid_grant" };
      },
      getProfileHistoryId: async () => "hist-1",
      loadLabelMap: async () => LABEL_MAP,
      modifyThreadLabels,
    };

    await expect(
      runScan({
        store,
        gmail,
        analyze: async () => ({ ok: true as const, analysis: validAnalysis() }),
      }),
    ).rejects.toMatchObject({ response: { status: 401 } });

    expect(store.connection.status).toBe("REAUTH_REQUIRED");
    expect(store.scanRuns.at(-1)?.errorCode).toBe("reauth_required");
    expect(store.scanRuns.at(-1)?.errorMessage).not.toMatch(/invalid_grant/);
    expect(modifyThreadLabels).not.toHaveBeenCalled();
  });

  it("does not advance gmail historyId when a scan is only partial", async () => {
    const store = createMemoryStore();
    store.connection.historyId = "hist-prior";
    store.connection.lastSuccessfulScanAt = "2026-09-10T08:00:00.000Z";
    const message = parsedMessage();
    const getProfileHistoryId = vi.fn(async () => "hist-should-not-persist");

    const result = await runScan({
      store,
      gmail: {
        listMessageRefs: async () => {
          throw new Error("window listing should not run in incremental mode");
        },
        listHistoryChanges: async () => ({
          ok: true,
          refs: [{ id: message.gmailMessageId, threadId: message.gmailThreadId }],
          latestHistoryId: "hist-should-not-persist",
        }),
        fetchThread: async () => [message],
        getProfileHistoryId,
        loadLabelMap: async () => LABEL_MAP,
        modifyThreadLabels: async () => undefined,
      },
      analyze: async () => ({ ok: false, error: new Error("gemini down") }),
    });

    expect(result.status).toBe("PARTIAL");
    expect(getProfileHistoryId).toHaveBeenCalled();
    expect(store.connection.historyId).toBe("hist-prior");
    expect(store.connection.lastSuccessfulScanAt).toBe("2026-09-10T08:00:00.000Z");
  });

  it("does not overwrite last_successful_scan_at when a new scan fails outright", async () => {
    const store = createMemoryStore();
    const message = parsedMessage();
    const okGmail: ScanGmailPort = {
      listMessageRefs: async () => [
        { id: message.gmailMessageId, threadId: message.gmailThreadId },
      ],
      listHistoryChanges: async () => {
        throw new Error("history should not run on the initial scan");
      },
      fetchThread: async () => [message],
      getProfileHistoryId: async () => "hist-1",
      loadLabelMap: async () => LABEL_MAP,
      modifyThreadLabels: async () => undefined,
    };

    await runScan({
      store,
      gmail: okGmail,
      analyze: async () => ({ ok: true, analysis: validAnalysis() }),
    });
    const successfulAt = store.connection.lastSuccessfulScanAt;
    expect(successfulAt).toBeTruthy();

    const failingGmail: ScanGmailPort = {
      ...okGmail,
      listHistoryChanges: async () => {
        throw new Error("gmail history failed");
      },
    };

    await expect(
      runScan({
        store,
        gmail: failingGmail,
        analyze: async () => ({ ok: true, analysis: validAnalysis() }),
      }),
    ).rejects.toThrow("gmail history failed");

    expect(store.connection.lastSuccessfulScanAt).toBe(successfulAt);
    expect(store.connection.lastAttemptedScanAt).toBeTruthy();
  });

  it("reanalyzes only the thread returned by history", async () => {
    const store = createMemoryStore();
    store.connection.historyId = "hist-1";
    store.connection.lastSuccessfulScanAt = "2026-09-10T08:00:00.000Z";
    await store.upsertThread({
      userId: "user-1",
      connectionId: "conn-1",
      gmailThreadId: "t-old",
      subject: "Old",
      participants: [],
      latestMessageAt: "2026-09-09T10:00:00.000Z",
      latestMessageDirection: "INBOUND",
      analysis: validAnalysis(),
      lastAnalyzedMessageId: "m-old",
      promptVersion: "v",
      modelName: "gemini-test",
    });

    const newMessage = parsedMessage({ gmailMessageId: "m-new", gmailThreadId: "t-new" });
    const analyze = vi.fn(async () => ({ ok: true as const, analysis: validAnalysis() }));
    const fetchThread = vi.fn(async (threadId: string) => {
      expect(threadId).toBe("t-new");
      return [newMessage];
    });

    const result = await runScan({
      store,
      gmail: {
        listMessageRefs: async () => {
          throw new Error("should not list the window");
        },
        listHistoryChanges: async () => ({
          ok: true,
          refs: [{ id: "m-new", threadId: "t-new" }],
          latestHistoryId: "hist-2",
        }),
        fetchThread,
        getProfileHistoryId: async () => "hist-2",
        loadLabelMap: async () => LABEL_MAP,
        modifyThreadLabels: async () => undefined,
      },
      analyze,
    });

    expect(result.mode).toBe("INCREMENTAL");
    expect(result.counters.threadsAnalyzed).toBe(1);
    expect(fetchThread).toHaveBeenCalledTimes(1);
    expect(analyze).toHaveBeenCalledTimes(1);
  });

  it("falls back to an overlap query when historyId is stale", async () => {
    const store = createMemoryStore();
    store.connection.historyId = "stale";
    store.connection.lastSuccessfulScanAt = "2026-09-10T12:00:00.000Z";
    const message = parsedMessage({ gmailMessageId: "m-overlap" });
    const now = new Date("2026-09-10T14:00:00.000Z");
    const epoch = Math.floor(Date.parse("2026-09-10T11:00:00.000Z") / 1000);
    const listMessageRefs = vi.fn(async (query: string) => {
      expect(query).toBe(`-in:spam -in:trash after:${epoch}`);
      return [{ id: message.gmailMessageId, threadId: message.gmailThreadId }];
    });

    const result = await runScan({
      store,
      gmail: {
        listMessageRefs,
        listHistoryChanges: async () => ({ ok: false, stale: true }),
        fetchThread: async () => [message],
        getProfileHistoryId: async () => "hist-fresh",
        loadLabelMap: async () => LABEL_MAP,
        modifyThreadLabels: async () => undefined,
      },
      analyze: async () => ({ ok: true, analysis: validAnalysis() }),
      now,
    });

    expect(result.mode).toBe("RECOVERY");
    expect(listMessageRefs).toHaveBeenCalledTimes(1);
    expect(store.threads.size).toBe(1);
    expect(store.connection.historyId).toBe("hist-fresh");
  });

  it("records thread progress as conversations are checked", async () => {
    const store = createMemoryStore();
    const first = parsedMessage({ gmailMessageId: "m1", gmailThreadId: "t1" });
    const second = parsedMessage({ gmailMessageId: "m2", gmailThreadId: "t2" });
    const result = await runScan({
      store,
      gmail: {
        listMessageRefs: async () => [
          { id: first.gmailMessageId, threadId: first.gmailThreadId },
          { id: second.gmailMessageId, threadId: second.gmailThreadId },
        ],
        listHistoryChanges: async () => {
          throw new Error("history should not run on the initial scan");
        },
        fetchThread: async (threadId) => [threadId === "t2" ? second : first],
        getProfileHistoryId: async () => "hist-1",
        loadLabelMap: async () => LABEL_MAP,
        modifyThreadLabels: async () => undefined,
      },
      analyze: async () => ({ ok: true, analysis: validAnalysis() }),
    });

    expect(result.status).toBe("SUCCESS");
    expect(store.progressChecks[0]).toBe(0);
    expect(store.progressChecks).toContain(1);
    expect(store.progressChecks.at(-1)).toBe(2);
  });
});

describe("openGmailScan user emails", () => {
  it("merges Gmail sendAs aliases into the authenticated address list", async () => {
    const store = createMemoryStore();
    const prepared = await openGmailScan({
      userId: "user-1",
      connectionId: "conn-1",
      gmailEmail: "me@example.com",
      lookbackDays: 7,
      now: new Date("2026-09-10T12:00:00.000Z"),
      gmail: {
        listMessageRefs: async () => [],
        listHistoryChanges: async () => ({ ok: true, refs: [], latestHistoryId: "1" }),
        fetchThread: async () => [],
        getProfileHistoryId: async () => "hist-1",
        loadLabelMap: async () => LABEL_MAP,
        modifyThreadLabels: async () => undefined,
        listSendAsEmails: async () => ["me@example.com", "alias@example.com"],
      },
      store,
      provider: unusedProvider(),
      modelName: "gemini-test",
    });
    expect(prepared.userEmails).toEqual(["me@example.com", "alias@example.com"]);
  });

  it("keeps the primary address when sendAs listing fails", async () => {
    const store = createMemoryStore();
    const prepared = await openGmailScan({
      userId: "user-1",
      connectionId: "conn-1",
      gmailEmail: "me@example.com",
      lookbackDays: 7,
      now: new Date("2026-09-10T12:00:00.000Z"),
      gmail: {
        listMessageRefs: async () => [],
        listHistoryChanges: async () => ({ ok: true, refs: [], latestHistoryId: "1" }),
        fetchThread: async () => [],
        getProfileHistoryId: async () => "hist-1",
        loadLabelMap: async () => LABEL_MAP,
        modifyThreadLabels: async () => undefined,
        listSendAsEmails: async () => {
          throw new Error("sendAs unavailable");
        },
      },
      store,
      provider: unusedProvider(),
      modelName: "gemini-test",
    });
    expect(prepared.userEmails).toEqual(["me@example.com"]);
  });
});

describe("openGmailScan admission", () => {
  const dummyGmail: ScanGmailPort = {
    listMessageRefs: async () => [],
    listHistoryChanges: async () => ({ ok: true, refs: [], latestHistoryId: "1" }),
    fetchThread: async () => [],
    getProfileHistoryId: async () => "hist-1",
    loadLabelMap: async () => LABEL_MAP,
    modifyThreadLabels: async () => undefined,
  };

  async function admit(
    store: ReturnType<typeof createMemoryStore>,
    now = new Date("2026-09-10T12:00:00.000Z"),
  ) {
    return openGmailScan({
      userId: "user-1",
      connectionId: "conn-1",
      gmailEmail: "me@example.com",
      lookbackDays: 7,
      now,
      gmail: dummyGmail,
      store,
      provider: unusedProvider(),
      modelName: "gemini-test",
    });
  }

  it("rejects a second scan while one is already running", async () => {
    const store = createMemoryStore();
    await admit(store);
    expect(store.connection.lastAttemptedScanAt).toBeTruthy();
    await expect(admit(store)).rejects.toThrow("SCAN_IN_PROGRESS");
    expect(store.scanRuns.filter((run) => run.status === "RUNNING")).toHaveLength(1);
  });

  it("rejects concurrent inserts for the same connection", async () => {
    const store = createMemoryStore();
    const first = store.insertScanRun({
      userId: "user-1",
      connectionId: "conn-1",
      triggerType: "MANUAL",
      windowStart: "2026-09-10T00:00:00.000Z",
      windowEnd: "2026-09-10T12:00:00.000Z",
      lookbackDays: 7,
    });
    const second = store.insertScanRun({
      userId: "user-1",
      connectionId: "conn-1",
      triggerType: "SCHEDULED",
      windowStart: "2026-09-10T00:00:00.000Z",
      windowEnd: "2026-09-10T12:00:00.000Z",
      lookbackDays: 7,
    });
    const results = await Promise.allSettled([first, second]);
    const accepted = results.filter((result) => result.status === "fulfilled");
    const rejected = results.filter((result) => result.status === "rejected");
    expect(accepted).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect(rejected[0]).toMatchObject({
      status: "rejected",
      reason: expect.objectContaining({ message: "SCAN_IN_PROGRESS" }),
    });
  });

  it("fails a stale running scan and then admits a new one", async () => {
    const store = createMemoryStore();
    const now = new Date("2026-09-10T12:00:00.000Z");
    store.scanRuns.push({
      id: "stale",
      status: "RUNNING",
      startedAt: new Date(now.getTime() - 21 * 60_000).toISOString(),
      updatedAt: new Date(now.getTime() - 21 * 60_000).toISOString(),
      connectionId: "conn-1",
    });
    const prepared = await admit(store, now);
    expect(prepared.scanId).not.toBe("stale");
    expect(store.scanRuns.find((run) => run.id === "stale")?.status).toBe("FAILED");
    expect(store.scanRuns.filter((run) => run.status === "RUNNING")).toHaveLength(1);
  });

  it("does not leave a RUNNING scan if settings fail to load", async () => {
    const store = createMemoryStore();
    store.getSettings = async () => {
      throw new Error("settings unavailable");
    };
    await expect(admit(store)).rejects.toThrow("settings unavailable");
    expect(store.scanRuns).toHaveLength(0);
  });
});

describe("shouldReuseStoredAnalysis", () => {
  it("reuses analysis only when the latest message and prompt version both match", () => {
    const row = {
      id: "thread-1",
      lastAnalyzedMessageId: "m1",
      promptVersion: TRIAGE_PROMPT_VERSION,
      analysis: null,
    };
    expect(shouldReuseStoredAnalysis(row, "m1", TRIAGE_PROMPT_VERSION)).toBe(true);
    expect(shouldReuseStoredAnalysis(row, "m1", "mailpilot-triage-v3")).toBe(false);
    expect(shouldReuseStoredAnalysis(row, "m2", TRIAGE_PROMPT_VERSION)).toBe(false);
    expect(shouldReuseStoredAnalysis(null, "m1", "mailpilot-triage-v4")).toBe(false);
  });

  it("changes the analysis key when ignore lists or custom instructions change", () => {
    const base: ScanSettings = {
      vipSenders: [],
      ignoredSenders: [],
      ignoredDomains: [],
      customAiInstructions: "",
      timezone: "Asia/Jerusalem",
      dailyScanTime: "08:00",
    };
    const withIgnore = { ...base, ignoredDomains: ["news.example.com"] };
    expect(analysisPromptKey(base)).not.toBe(analysisPromptKey(withIgnore));
    expect(
      shouldReuseStoredAnalysis(
        {
          id: "thread-1",
          lastAnalyzedMessageId: "m1",
          promptVersion: analysisPromptKey(base),
          analysis: null,
        },
        "m1",
        analysisPromptKey(withIgnore),
      ),
    ).toBe(false);
  });
});
