import { describe, expect, it, vi } from "vitest";

import type { ActionRecord } from "@/lib/actions/reconcile-action";
import type { EmailTriageProvider } from "@/lib/ai/analyze-thread";
import { TRIAGE_PROMPT_VERSION } from "@/lib/ai/prompts";
import { threadAnalysisSchema, type ThreadAnalysis } from "@/lib/ai/schemas";
import type { MailPilotLogicalLabel } from "@/lib/gmail/constants";
import type { ParsedGmailMessage } from "@/lib/gmail/parser";
import type { InitialLookbackDays } from "@/lib/scans/lookback";
import { processInitialScan, shouldReuseStoredAnalysis } from "@/lib/scans/process-scan";
import type { ScanGmailPort, ScanSettings, ScanStorePort, StoredThreadRow } from "@/lib/scans/types";

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
  };
  scanRuns: Array<{ id: string; status: string }>;
  progressChecks: number[];
} {
  const threads = new Map<string, StoredThreadRow & { gmailThreadId: string; subject: string | null }>();
  const messages = new Map<string, string>();
  const actions = new Map<string, ActionRecord>();
  const scanRuns: Array<{
    id: string;
    status: string;
    startedAt: string;
    threadsDiscovered?: number;
    threadsChecked?: number;
  }> = [];
  const progressChecks: number[] = [];
  const connection = {
    lastSuccessfulScanAt: null as string | null,
    lastAttemptedScanAt: null as string | null,
    historyId: null as string | null,
  };
  const settings: ScanSettings = {
    vipSenders: [],
    ignoredSenders: [],
    timezone: "Asia/Jerusalem",
    dailyScanTime: "08:00",
  };

  const store: ScanStorePort & {
    threads: typeof threads;
    messages: typeof messages;
    actions: typeof actions;
    connection: typeof connection;
    scanRuns: Array<{ id: string; status: string }>;
    progressChecks: number[];
  } = {
    threads,
    messages,
    actions,
    connection,
    scanRuns,
    progressChecks,
    async findRunningScan() {
      const running = scanRuns.find((run) => run.status === "RUNNING");
      return running ? { id: running.id, startedAt: running.startedAt } : null;
    },
    async failScan(scanId) {
      const run = scanRuns.find((item) => item.id === scanId);
      if (run) {
        run.status = "FAILED";
      }
    },
    async insertScanRun() {
      const id = crypto.randomUUID();
      scanRuns.push({ id, status: "RUNNING", startedAt: new Date().toISOString() });
      return id;
    },
    async updateScanRun(scanId, patch) {
      const run = scanRuns.find((item) => item.id === scanId);
      if (run) {
        run.status = patch.status;
        if (patch.threadsDiscovered !== undefined) {
          run.threadsDiscovered = patch.threadsDiscovered;
        }
        if (patch.threadsChecked !== undefined) {
          run.threadsChecked = patch.threadsChecked;
          progressChecks.push(patch.threadsChecked);
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
    expect(modifyThreadLabels).toHaveBeenCalledWith(
      "t1",
      ["L_IMP", "L_ACT", "L_PROC"],
      [],
    );

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
      listMessageRefs: async () => [{ id: message.gmailMessageId, threadId: message.gmailThreadId }],
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
  });

  it("does not overwrite last_successful_scan_at when a new scan fails outright", async () => {
    const store = createMemoryStore();
    const message = parsedMessage();
    const okGmail: ScanGmailPort = {
      listMessageRefs: async () => [{ id: message.gmailMessageId, threadId: message.gmailThreadId }],
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
});
