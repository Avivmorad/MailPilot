import { describe, expect, it, vi } from "vitest";

import { GeminiEmailTriageProvider, GEMINI_REQUEST_TIMEOUT_MS } from "@/lib/ai/client";
import { TRIAGE_SYSTEM_PROMPT, UNTRUSTED_THREAD_START } from "@/lib/ai/prompts";
import { threadAnalysisJsonSchema, type ThreadAnalysis } from "@/lib/ai/schemas";
import type { ThreadAnalysisInput } from "@/lib/ai/types";
import { ABSENT_USAGE, type GenerateWithUsage } from "@/lib/ai/usage";

const env = { GEMINI_API_KEY: "test-key", GEMINI_MODEL: "gemini-3.1-flash-lite" };

const input: ThreadAnalysisInput = {
  userEmails: ["me@example.com"],
  threadText: "Please reply today.",
  latestFrom: "ada@example.com",
  latestSubject: "Ping",
  latestDirection: "INBOUND",
};

const validPayload: ThreadAnalysis = {
  summary: "בקשה להשיב היום",
  importance: "medium",
  importance_reason: "direct question",
  status: "action_required",
  requires_action: true,
  requires_reply: true,
  action_type: "reply",
  action_summary: "השב למייל",
  action_reason: "asked for a reply",
  waiting_for: null,
  waiting_since: null,
  urgency: "soon",
  deadline: null,
  deadline_text: "today",
  category: "other",
  sender_name: "Ada",
  organization: null,
  confidence: 0.8,
  short_display_title: "בקשת תשובה",
};

function textResult(text: string, usage = ABSENT_USAGE): GenerateWithUsage {
  return { text, usage };
}

describe("GeminiEmailTriageProvider", () => {
  it("aborts a hung request without retrying", async () => {
    vi.useFakeTimers();
    try {
      let signal: AbortSignal | undefined;
      const generate = vi.fn((params) => {
        signal = params.signal;
        return new Promise<GenerateWithUsage>(() => {});
      });
      const provider = new GeminiEmailTriageProvider(env, generate);
      const assertion = expect(provider.analyzeThread(input)).rejects.toThrow(/timed out/i);
      await vi.advanceTimersByTimeAsync(GEMINI_REQUEST_TIMEOUT_MS);
      await assertion;
      expect(signal?.aborted).toBe(true);
      expect(generate).toHaveBeenCalledTimes(1);
      expect(vi.getTimerCount()).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });
  it("parses structured JSON from Gemini", async () => {
    const provider = new GeminiEmailTriageProvider(env, async (params) => {
      expect(params.apiKey).toBe("test-key");
      expect(params.model).toBe("gemini-3.1-flash-lite");
      expect(params.systemInstruction).toBe(TRIAGE_SYSTEM_PROMPT);
      expect(params.userPrompt).toContain(UNTRUSTED_THREAD_START);
      expect(params.responseJsonSchema).toEqual(threadAnalysisJsonSchema);
      return textResult(JSON.stringify(validPayload), {
        inputTokens: 50,
        outputTokens: 10,
        reasoningTokens: null,
        totalTokens: 60,
        source: "provider",
      });
    });

    const result = await provider.analyzeThread(input);
    expect(result.status).toBe("action_required");
    expect(result.requires_reply).toBe(true);
  });

  it("retries Gemini 429 then succeeds", async () => {
    let attempts = 0;
    const provider = new GeminiEmailTriageProvider(env, async () => {
      attempts += 1;
      if (attempts === 1) {
        const error = new Error("rate limited") as Error & { status: number };
        error.status = 429;
        throw error;
      }
      return textResult(JSON.stringify(validPayload));
    });

    const result = await provider.analyzeThread(input);
    expect(result.summary).toBe(validPayload.summary);
    expect(attempts).toBe(2);
  });

  it("retries Gemini 503 then succeeds", async () => {
    let attempts = 0;
    const provider = new GeminiEmailTriageProvider(env, async () => {
      attempts += 1;
      if (attempts === 1) {
        const error = new Error("overloaded") as Error & { status: number };
        error.status = 503;
        throw error;
      }
      return textResult(JSON.stringify(validPayload));
    });

    const result = await provider.analyzeThread(input);
    expect(result.summary).toBe(validPayload.summary);
    expect(attempts).toBe(2);
  });

  it("fails closed on empty or invalid JSON", async () => {
    const empty = new GeminiEmailTriageProvider(env, async () => textResult(""));
    await expect(empty.analyzeThread(input)).rejects.toThrow(/empty/i);

    const invalid = new GeminiEmailTriageProvider(env, async () => textResult("{not-json"));
    await expect(invalid.analyzeThread(input)).rejects.toThrow(/non-JSON/i);
  });

  it("emits schema outcome usage without response text", async () => {
    const events: unknown[] = [];
    const provider = new GeminiEmailTriageProvider(env, async () =>
      textResult("{not-json", {
        inputTokens: 9,
        outputTokens: 1,
        reasoningTokens: null,
        totalTokens: 10,
        source: "provider",
      }),
    );
    await expect(
      provider.analyzeThread(input, {
        onProviderUsage: (event) => {
          events.push(event);
        },
      }),
    ).rejects.toThrow(/non-JSON/i);
    expect(events).toEqual([
      expect.objectContaining({
        provider: "gemini",
        outcome: "schema",
        usage: expect.objectContaining({ inputTokens: 9, source: "provider" }),
      }),
    ]);
    expect(JSON.stringify(events)).not.toMatch(/\{not-json|Please reply/i);
  });
});
