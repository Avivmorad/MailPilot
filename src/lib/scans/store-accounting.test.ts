import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { threadAnalysisSchema } from "@/lib/ai/schemas";
import type { ScanStorePort } from "@/lib/scans/types";

const state = vi.hoisted(() => ({
  row: null as Record<string, unknown> | null,
  upsert: vi.fn(),
  select: vi.fn(),
  error: null as { message: string } | null,
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: (table: string) => {
      if (table !== "email_threads") throw new Error("Unexpected table");
      const builder = {
        upsert: (row: Record<string, unknown>, options: unknown) => {
          state.upsert(row, options);
          state.row = { id: "thread-row", ...row };
          return builder;
        },
        select: (columns: string) => {
          state.select(columns);
          return builder;
        },
        eq: () => builder,
        single: async () => ({ data: state.row, error: state.error }),
        maybeSingle: async () => ({ data: state.row, error: state.error }),
      };
      return builder;
    },
  }),
}));

import { createSupabaseScanStore } from "@/lib/scans/store";

function input(): Parameters<ScanStorePort["upsertThread"]>[0] {
  return {
    userId: "user-1",
    connectionId: "conn-1",
    gmailThreadId: "gmail-thread-1",
    subject: "Synthetic FYI",
    participants: [],
    latestMessageAt: null,
    latestMessageDirection: "INBOUND",
    lastAnalyzedMessageId: "message-1",
    promptVersion: "prompt-1",
    modelName: "synthetic-model",
    analysisScanId: "11111111-1111-4111-8111-111111111111",
    analysis: threadAnalysisSchema.parse({
      summary: "A synthetic update.",
      short_display_title: "Synthetic update",
      importance: "low",
      importance_reason: "No action needed",
      status: "informational",
      requires_action: false,
      requires_reply: false,
      action_type: "none",
      action_summary: null,
      action_reason: null,
      waiting_for: null,
      waiting_since: null,
      urgency: "none",
      deadline: null,
      deadline_text: null,
      category: "other",
      sender_name: null,
      organization: null,
      confidence: 0.9,
    }),
  };
}

describe("durable scan analysis attribution", () => {
  beforeEach(() => {
    state.row = null;
    state.error = null;
    vi.clearAllMocks();
  });

  it("writes attribution with validated analysis and reads it back for replay", async () => {
    const store = createSupabaseScanStore();
    const value = input();
    await store.upsertThread(value);
    expect(state.upsert).toHaveBeenCalledTimes(1);
    expect(state.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        summary: value.analysis?.summary,
        analysis_scan_id: value.analysisScanId,
        last_analyzed_message_id: "message-1",
        prompt_version: "prompt-1",
      }),
      { onConflict: "gmail_connection_id,gmail_thread_id" },
    );
    expect(await store.getThread("conn-1", "gmail-thread-1")).toMatchObject({
      analysisScanId: value.analysisScanId,
      analysis: { status: "informational" },
    });
    expect(state.select.mock.calls.at(-1)?.[0]).toContain("analysis_scan_id");
  });

  it("does not invent attribution for legacy cached analysis", async () => {
    const value = input();
    delete value.analysisScanId;
    const store = createSupabaseScanStore();
    await store.upsertThread(value);
    expect(state.row?.analysis_scan_id).toBeNull();
    expect((await store.getThread("conn-1", "gmail-thread-1"))?.analysisScanId).toBeNull();
  });

  it("does not attribute a missing analysis to the supplied scan", async () => {
    await createSupabaseScanStore().upsertThread({ ...input(), analysis: null });
    expect(state.row?.analysis_scan_id).toBeNull();
  });

  it("does not invent an informational For You status when classification never ran", async () => {
    await createSupabaseScanStore().upsertThread({ ...input(), analysis: null });
    expect(state.row).toMatchObject({
      status: null,
      summary: null,
      category: null,
      short_display_title: null,
    });
  });

  it("does not revive analysis from literal nullish stored titles", async () => {
    state.row = {
      id: "thread-row",
      summary: "null",
      short_display_title: "undefined",
      importance: "low",
      importance_reason: "noise",
      status: "informational",
      requires_action: false,
      requires_reply: false,
      action_type: "none",
      action_summary: null,
      action_reason: null,
      waiting_for: null,
      waiting_since: null,
      urgency: "none",
      deadline: null,
      deadline_text: null,
      category: "other",
      confidence: 0.5,
      last_analyzed_message_id: "message-1",
      analysis_scan_id: null,
      prompt_version: "prompt-1",
    };
    const loaded = await createSupabaseScanStore().getThread("conn-1", "gmail-thread-1");
    expect(loaded?.analysis).toBeNull();
  });

  it("surfaces failed persistence instead of reporting a saved analysis", async () => {
    state.error = { message: "synthetic write failure" };
    await expect(createSupabaseScanStore().upsertThread(input())).rejects.toThrow(
      "Failed to upsert email thread",
    );
  });

  it("draft migration preserves existing rows, grants and scan deletion semantics", () => {
    const sql = readFileSync(
      "supabase/migrations/20260929174644_analysis_scan_attribution.sql",
      "utf8",
    );
    expect(sql).toMatch(
      /add column if not exists analysis_scan_id uuid\s+references public\.scan_runs \(id\) on delete set null/i,
    );
    expect(sql).toMatch(/create index if not exists email_threads_analysis_scan_idx/i);
    expect(sql).toMatch(/where analysis_scan_id is not null/i);
    expect(sql).not.toMatch(/\b(grant|disable row level security|drop table|update public\.)\b/i);
  });
});
