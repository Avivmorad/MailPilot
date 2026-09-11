import { describe, expect, it, vi } from "vitest";

import {
  analyzeThenApplyLabels,
  analyzeThread,
  ThreadTriageError,
  tryAnalyzeThread,
  type EmailTriageProvider,
} from "@/lib/ai/analyze-thread";
import { threadAnalysisSchema, type ThreadAnalysis } from "@/lib/ai/schemas";
import type { ThreadAnalysisInput } from "@/lib/ai/types";

const input: ThreadAnalysisInput = {
  userEmails: ["me@example.com"],
  threadText: "Can you approve the budget?",
  latestFrom: "ada@example.com",
  latestSubject: "Budget",
  latestDirection: "INBOUND",
};

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

describe("analyzeThread", () => {
  it("returns post-processed analysis from a successful provider", async () => {
    const provider: EmailTriageProvider = {
      analyzeThread: async () => validAnalysis({ requires_action: false, action_summary: null }),
    };

    const result = await analyzeThread(input, provider);
    expect(result.status).toBe("action_required");
    expect(result.requires_action).toBe(true);
    expect(result.action_summary).toBeTruthy();
  });

  it("rejects invalid provider JSON via schema validation", async () => {
    const provider: EmailTriageProvider = {
      analyzeThread: async () => ({ hello: "world" }) as unknown as ThreadAnalysis,
    };

    await expect(analyzeThread(input, provider)).rejects.toBeInstanceOf(ThreadTriageError);
  });
});

describe("analyzeThenApplyLabels", () => {
  it("does not apply Gmail labels when the provider fails", async () => {
    const applyGmailLabels = vi.fn(async () => undefined);
    const provider: EmailTriageProvider = {
      analyzeThread: async () => {
        throw new Error("Gemini 503");
      },
    };

    const outcome = await analyzeThenApplyLabels(input, provider, applyGmailLabels);
    expect(outcome.ok).toBe(false);
    expect(applyGmailLabels).not.toHaveBeenCalled();
  });

  it("applies Gmail labels only after validated analysis", async () => {
    const applyGmailLabels = vi.fn(async () => undefined);
    const provider: EmailTriageProvider = {
      analyzeThread: async () => validAnalysis(),
    };

    const outcome = await analyzeThenApplyLabels(input, provider, applyGmailLabels);
    expect(outcome.ok).toBe(true);
    expect(applyGmailLabels).toHaveBeenCalledOnce();
  });
});

describe("tryAnalyzeThread", () => {
  it("returns ok:false instead of throwing", async () => {
    const outcome = await tryAnalyzeThread(input, {
      analyzeThread: async () => {
        throw new Error("network");
      },
    });
    expect(outcome.ok).toBe(false);
  });
});
