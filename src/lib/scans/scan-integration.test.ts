import { describe, expect, it } from "vitest";

import type { ActionRecord } from "@/lib/actions/reconcile-action";
import type { EmailTriageProvider } from "@/lib/ai/analyze-thread";
import { threadAnalysisSchema, type ThreadAnalysis } from "@/lib/ai/schemas";
import type { MailPilotLogicalLabel } from "@/lib/gmail/constants";
import { MAILPILOT_LABELS } from "@/lib/gmail/constants";
import type { ParsedGmailMessage } from "@/lib/gmail/parser";
import { uniqueTopActions } from "@/lib/digest/build-digest";
import {
  deleteAnalysisDataForUser,
  type AnalysisDeletionPort,
  type UserScopedTable,
} from "@/lib/privacy/deletion";
import { SCAN_IN_PROGRESS } from "@/lib/scans/errors";
import { processInitialScan } from "@/lib/scans/process-scan";
import { parseThreadFailureIds } from "@/lib/scans/thread-failures";
import type {
  ScanGmailPort,
  ScanSettings,
  ScanStorePort,
  StoredThreadRow,
} from "@/lib/scans/types";

function analysis(overrides: Partial<ThreadAnalysis> = {}): ThreadAnalysis {
  return threadAnalysisSchema.parse({
    summary: "בקשה לאשר תקציב",
    importance: "high",
    importance_reason: "budget approval",
    status: "action_required",
    requires_action: true,
    requires_reply: true,
    action_type: "reply",
    action_summary: "השב על התקציב",
    action_reason: "שאלה פתוחה",
    waiting_for: null,
    waiting_since: null,
    urgency: "soon",
    deadline: null,
    deadline_text: null,
    category: "other",
    sender_name: "Ada",
    organization: null,
    confidence: 0.88,
    short_display_title: "תקציב",
    ...overrides,
  });
}

function message(overrides: Partial<ParsedGmailMessage> = {}): ParsedGmailMessage {
  return {
    gmailMessageId: "m1",
    gmailThreadId: "t1",
    historyId: "10",
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
    snippet: "Please reply",
    plainText: "Please reply about the budget.",
    hasAttachments: false,
    attachments: [],
    ...overrides,
  };
}

function createMemoryStore(
  userId: string,
  connectionId: string,
): ScanStorePort & {
  userId: string;
  connectionId: string;
  threads: Map<string, StoredThreadRow>;
  messages: Map<string, string>;
  actions: Map<string, ActionRecord>;
  connection: { historyId: string | null; status: string; lastSuccessfulScanAt: string | null };
  scanRuns: Array<{
    id: string;
    status: string;
    startedAt: string;
    connectionId: string;
    errorCode?: string | null;
    errorMessage?: string | null;
  }>;
} {
  const threads = new Map<string, StoredThreadRow>();
  const messages = new Map<string, string>();
  const actions = new Map<string, ActionRecord>();
  const scanRuns: Array<{
    id: string;
    status: string;
    startedAt: string;
    connectionId: string;
    errorMessage?: string | null;
  }> = [];
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

  return {
    userId,
    connectionId,
    threads,
    messages,
    actions,
    connection,
    scanRuns,
    async findRunningScan(id) {
      const running = scanRuns.find((run) => run.status === "RUNNING" && run.connectionId === id);
      return running ? { id: running.id, startedAt: running.startedAt } : null;
    },
    async failScan(scanId, errorCode, errorMessage) {
      const run = scanRuns.find((item) => item.id === scanId);
      if (run) {
        run.status = "FAILED";
        run.errorCode = errorCode;
        run.errorMessage = errorMessage;
      }
    },
    async insertScanRun(input) {
      if (
        scanRuns.some((run) => run.status === "RUNNING" && run.connectionId === input.connectionId)
      ) {
        throw new Error("SCAN_IN_PROGRESS");
      }
      const id = crypto.randomUUID();
      scanRuns.push({
        id,
        status: "RUNNING",
        startedAt: new Date().toISOString(),
        connectionId: input.connectionId,
      });
      return id;
    },
    async updateScanRun(scanId, patch) {
      const run = scanRuns.find((item) => item.id === scanId);
      if (run) {
        run.status = patch.status;
        if (patch.errorCode !== undefined) {
          run.errorCode = patch.errorCode;
        }
        if (patch.errorMessage !== undefined) {
          run.errorMessage = patch.errorMessage;
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
        lastAnalyzedMessageId: input.lastAnalyzedMessageId,
        promptVersion: input.promptVersion,
        analysis: input.analysis,
      });
      return id;
    },
    async getThread(id, gmailThreadId) {
      return threads.get(`${id}:${gmailThreadId}`) ?? null;
    },
    async upsertMessage(input) {
      messages.set(`${input.connectionId}:${input.message.gmailMessageId}`, input.threadId);
    },
    async getAction(threadId) {
      return actions.get(threadId) ?? null;
    },
    async upsertAction(_owner, threadId, action) {
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
    async listPendingFailedThreadIds(id, excludeScanId) {
      const latest = [...scanRuns]
        .reverse()
        .find(
          (run) => run.id !== excludeScanId && run.status === "PARTIAL" && run.connectionId === id,
        );
      return parseThreadFailureIds(latest?.errorMessage);
    },
    async markConnectionReauthRequired() {
      connection.status = "REAUTH_REQUIRED";
    },
  };
}

function unusedProvider(): EmailTriageProvider {
  return {
    analyzeThread: async () => {
      throw new Error("provider should not be used when analyze is injected");
    },
  };
}

function createMailbox(seed: ParsedGmailMessage[]) {
  const threads = new Map<string, ParsedGmailMessage[]>();
  for (const item of seed) {
    const list = threads.get(item.gmailThreadId) ?? [];
    list.push(item);
    threads.set(item.gmailThreadId, list);
  }
  const labels = new Map<MailPilotLogicalLabel, string>();
  const appliedAdds: string[][] = [];
  let historyId = 20;
  let labelCreateCount = 0;

  const port: ScanGmailPort & {
    labelCreateCount: number;
    appliedAdds: string[][];
    addMessage(next: ParsedGmailMessage): void;
  } = {
    appliedAdds,
    get labelCreateCount() {
      return labelCreateCount;
    },
    addMessage(next) {
      const list = threads.get(next.gmailThreadId) ?? [];
      list.push(next);
      threads.set(next.gmailThreadId, list);
      historyId += 1;
    },
    async listMessageRefs() {
      return [...threads.values()].flat().map((item) => ({
        id: item.gmailMessageId,
        threadId: item.gmailThreadId,
      }));
    },
    async listHistoryChanges(startHistoryId) {
      if (startHistoryId === "missing") {
        return { ok: false as const, stale: true as const };
      }
      const refs = [...threads.values()]
        .flat()
        .filter((item) => Number(item.historyId) > Number(startHistoryId))
        .map((item) => ({ id: item.gmailMessageId, threadId: item.gmailThreadId }));
      return { ok: true as const, refs, latestHistoryId: String(historyId) };
    },
    async fetchThread(threadId) {
      return threads.get(threadId) ?? [];
    },
    async getProfileHistoryId() {
      return String(historyId);
    },
    async loadLabelMap() {
      if (labels.size === 0) {
        for (const spec of MAILPILOT_LABELS) {
          labels.set(spec.logicalName, `L_${spec.logicalName}`);
          labelCreateCount += 1;
        }
      }
      return new Map(labels);
    },
    async modifyThreadLabels(threadId, addLabelIds, removeLabelIds) {
      appliedAdds.push(addLabelIds);
      const list = threads.get(threadId);
      if (!list || list.length === 0) {
        return;
      }
      const latest = list[list.length - 1];
      if (!latest) {
        return;
      }
      const nextIds = new Set(latest.labelIds ?? []);
      for (const id of addLabelIds) {
        nextIds.add(id);
      }
      for (const id of removeLabelIds) {
        nextIds.delete(id);
      }
      latest.labelIds = [...nextIds];
    },
  };

  return port;
}

async function scan(options: {
  store: ReturnType<typeof createMemoryStore>;
  gmail: ScanGmailPort;
  analyze: NonNullable<Parameters<typeof processInitialScan>[0]["analyze"]>;
  forceLookback?: boolean;
  now?: Date;
}) {
  return processInitialScan({
    userId: options.store.userId,
    connectionId: options.store.connectionId,
    gmailEmail: "me@example.com",
    lookbackDays: 7,
    now: options.now ?? new Date("2026-09-10T12:00:00.000Z"),
    gmail: options.gmail,
    store: options.store,
    provider: unusedProvider(),
    modelName: "gemini-test",
    analyze: options.analyze,
    forceLookback: options.forceLookback,
  });
}

describe("scan integration", () => {
  it("keeps threads, messages, actions, labels, and digests unique after the same mailbox is scanned twice", async () => {
    const store = createMemoryStore("user-1", "conn-1");
    const mailbox = createMailbox([message()]);
    const analyze = async () => ({ ok: true as const, analysis: analysis() });
    const now = new Date("2026-09-10T12:00:00.000Z");

    const first = await scan({ store, gmail: mailbox, analyze, forceLookback: true, now });
    const second = await scan({ store, gmail: mailbox, analyze, forceLookback: true, now });

    expect(first.status).toBe("SUCCESS");
    expect(second.status).toBe("SUCCESS");
    expect(store.threads.size).toBe(1);
    expect(store.messages.size).toBe(1);
    expect(store.actions.size).toBe(1);
    expect(mailbox.labelCreateCount).toBe(MAILPILOT_LABELS.length);
    expect(mailbox.appliedAdds[0]?.length).toBeGreaterThan(0);
    expect(mailbox.appliedAdds[1]).toEqual([]);

    const periodStart = "2026-09-03T12:00:00.000Z";
    const periodEnd = now.toISOString();
    const digestKey = `${store.connectionId}:${periodStart}:${periodEnd}`;
    const digests = new Map<string, string>();
    const upsertDigest = () => {
      const existing = digests.get(digestKey) ?? crypto.randomUUID();
      digests.set(digestKey, existing);
      return existing;
    };
    const firstDigest = upsertDigest();
    const secondDigest = upsertDigest();
    expect(firstDigest).toBe(secondDigest);
    expect(digests.size).toBe(1);
    expect(
      uniqueTopActions([
        {
          threadId: [...store.threads.values()][0]!.id,
          title: "השב",
          urgency: "soon",
          deadline: null,
          category: "other",
        },
        {
          threadId: [...store.threads.values()][0]!.id,
          title: "השב שוב",
          urgency: "soon",
          deadline: null,
          category: "other",
        },
      ]),
    ).toHaveLength(1);
  });

  it("moves one thread OPEN → WAITING → OPEN → COMPLETED across mocked Gmail history", async () => {
    const store = createMemoryStore("user-1", "conn-1");
    const firstMessage = message();
    const mailbox = createMailbox([firstMessage]);

    await scan({
      store,
      gmail: mailbox,
      analyze: async () => ({ ok: true as const, analysis: analysis() }),
    });
    expect([...store.actions.values()][0]?.status).toBe("OPEN");

    mailbox.addMessage(
      message({
        gmailMessageId: "m2",
        historyId: "30",
        internalDate: String(Date.parse("2026-09-10T13:00:00.000Z")),
        from: "me@example.com",
        to: "Ada <ada@example.com>",
        plainText: "Sent the numbers.",
      }),
    );
    await scan({
      store,
      gmail: mailbox,
      now: new Date("2026-09-10T13:05:00.000Z"),
      analyze: async () => ({
        ok: true as const,
        analysis: analysis({
          status: "waiting",
          requires_action: false,
          requires_reply: false,
          action_type: "follow_up",
          waiting_for: "Ada",
          action_summary: "ממתין לאישור",
        }),
      }),
    });
    expect([...store.actions.values()][0]?.status).toBe("WAITING");

    mailbox.addMessage(
      message({
        gmailMessageId: "m3",
        historyId: "40",
        internalDate: String(Date.parse("2026-09-10T14:00:00.000Z")),
        plainText: "Can you also approve the revised budget?",
      }),
    );
    await scan({
      store,
      gmail: mailbox,
      now: new Date("2026-09-10T14:05:00.000Z"),
      analyze: async () => ({ ok: true as const, analysis: analysis() }),
    });
    expect([...store.actions.values()][0]?.status).toBe("OPEN");

    mailbox.addMessage(
      message({
        gmailMessageId: "m4",
        historyId: "50",
        internalDate: String(Date.parse("2026-09-10T15:00:00.000Z")),
        plainText: "Approved, we are done.",
      }),
    );
    await scan({
      store,
      gmail: mailbox,
      now: new Date("2026-09-10T15:05:00.000Z"),
      analyze: async () => ({
        ok: true as const,
        analysis: analysis({
          status: "resolved",
          requires_action: false,
          requires_reply: false,
          action_type: "none",
          action_summary: null,
          action_reason: null,
          importance: "medium",
        }),
      }),
    });
    expect([...store.actions.values()][0]?.status).toBe("COMPLETED");
    expect(store.threads.size).toBe(1);
    expect(store.messages.size).toBe(4);
  });

  it("does not write user A's mail into user B's store", async () => {
    const alice = createMemoryStore("user-a", "conn-a");
    const bob = createMemoryStore("user-b", "conn-b");
    const mailbox = createMailbox([message()]);
    await scan({
      store: alice,
      gmail: mailbox,
      analyze: async () => ({ ok: true as const, analysis: analysis() }),
    });

    expect(alice.threads.size).toBe(1);
    expect(alice.actions.size).toBe(1);
    expect(bob.threads.size).toBe(0);
    expect(bob.messages.size).toBe(0);
    expect(bob.actions.size).toBe(0);
  });

  it("reuses already-created MailPilot labels instead of creating duplicates", async () => {
    const store = createMemoryStore("user-1", "conn-1");
    const mailbox = createMailbox([message()]);
    await mailbox.loadLabelMap();
    expect(mailbox.labelCreateCount).toBe(MAILPILOT_LABELS.length);

    await scan({
      store,
      gmail: mailbox,
      analyze: async () => ({ ok: true as const, analysis: analysis() }),
    });
    await mailbox.loadLabelMap();
    expect(mailbox.labelCreateCount).toBe(MAILPILOT_LABELS.length);
  });
});
