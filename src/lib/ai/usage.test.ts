import { describe, expect, it } from "vitest";

import { PRICE_TABLE_VERSION, priceUsage } from "@/lib/ai/pricing";
import {
  ABSENT_USAGE,
  buildTriageUsageRow,
  nvidiaContentFromPayload,
  parseGeminiUsage,
  parseNvidiaUsage,
} from "@/lib/ai/usage";

describe("parseNvidiaUsage", () => {
  it("normalizes provider usage and never exposes email-like content", () => {
    const payload = {
      choices: [
        {
          message: {
            content: '{"summary":"Please reply to secret@example.com"}',
            reasoning_content: "The user email body said please reply today.",
          },
        },
      ],
      usage: {
        prompt_tokens: 1200,
        completion_tokens: 80,
        total_tokens: 1280,
        completion_tokens_details: { reasoning_tokens: 25 },
        extra_vendor_field: "drop-me",
      },
    };

    const usage = parseNvidiaUsage(payload);
    expect(usage).toEqual({
      inputTokens: 1200,
      outputTokens: 80,
      reasoningTokens: 25,
      totalTokens: 1280,
      source: "provider",
    });
    expect(JSON.stringify(usage)).not.toMatch(/secret@example|Please reply|email body/i);
    expect(nvidiaContentFromPayload(payload)).toContain("secret@example.com");
  });

  it("returns absent when usage is missing", () => {
    expect(parseNvidiaUsage({ choices: [{ message: { content: "{}" } }] })).toEqual(ABSENT_USAGE);
    expect(parseNvidiaUsage(null)).toEqual(ABSENT_USAGE);
  });
});

describe("parseGeminiUsage", () => {
  it("normalizes usageMetadata without keeping free-form fields", () => {
    const usage = parseGeminiUsage({
      promptTokenCount: 8000,
      candidatesTokenCount: 400,
      thoughtsTokenCount: 50,
      totalTokenCount: 8450,
      promptTokensDetails: [{ modality: "TEXT", tokenCount: 8000 }],
    });
    expect(usage).toEqual({
      inputTokens: 8000,
      outputTokens: 400,
      reasoningTokens: 50,
      totalTokens: 8450,
      source: "provider",
    });
    expect(usage).not.toHaveProperty("promptTokensDetails");
  });

  it("returns absent when usageMetadata is missing", () => {
    expect(parseGeminiUsage(undefined)).toEqual(ABSENT_USAGE);
  });
});

describe("priceUsage", () => {
  it("prices free NVIDIA and Gemini rows at 0 micro-USD and billable false", () => {
    const nvidia = priceUsage("nvidia", "openai/gpt-oss-20b", {
      inputTokens: 10_000,
      outputTokens: 500,
      reasoningTokens: 100,
      totalTokens: 10_500,
      source: "provider",
    });
    expect(nvidia).toEqual({
      pricedMicroUsd: 0,
      billable: false,
      priceTableVersion: PRICE_TABLE_VERSION,
    });

    const gemini = priceUsage("gemini", "gemini-3.1-flash-lite", {
      inputTokens: 8_000,
      outputTokens: 400,
      reasoningTokens: 50,
      totalTokens: 8_450,
      source: "provider",
    });
    expect(gemini).toEqual({
      pricedMicroUsd: 0,
      billable: false,
      priceTableVersion: PRICE_TABLE_VERSION,
    });
  });

  it("leaves priced_micro_usd null for unknown models", () => {
    const priced = priceUsage("gemini", "gemini-unknown-model", {
      inputTokens: 100,
      outputTokens: 10,
      reasoningTokens: null,
      totalTokens: 110,
      source: "provider",
    });
    expect(priced.pricedMicroUsd).toBeNull();
    expect(priced.billable).toBe(false);
  });

  it("leaves priced_micro_usd null when usage is absent", () => {
    const priced = priceUsage("nvidia", "openai/gpt-oss-20b", ABSENT_USAGE);
    expect(priced.pricedMicroUsd).toBeNull();
    expect(priced.billable).toBe(false);
  });
});

describe("buildTriageUsageRow", () => {
  it("builds an insert row without prompt or response fields", () => {
    const row = buildTriageUsageRow(
      {
        userId: "user-1",
        connectionId: "conn-1",
        scanId: "scan-1",
        promptVersion: "mailpilot-triage-v9:abcdef0123456789",
      },
      {
        provider: "nvidia",
        model: "openai/gpt-oss-20b",
        attempt: 0,
        outcome: "ok",
        durationMs: 420,
        usage: {
          inputTokens: 100,
          outputTokens: 20,
          reasoningTokens: 5,
          totalTokens: 120,
          source: "provider",
        },
      },
    );

    expect(row).toMatchObject({
      user_id: "user-1",
      gmail_connection_id: "conn-1",
      scan_id: "scan-1",
      provider: "nvidia",
      model: "openai/gpt-oss-20b",
      prompt_version: "mailpilot-triage-v9:abcdef0123456789",
      attempt: 0,
      outcome: "ok",
      usage_source: "provider",
      input_tokens: 100,
      output_tokens: 20,
      reasoning_tokens: 5,
      total_tokens: 120,
      priced_micro_usd: 0,
      billable: false,
      duration_ms: 420,
    });
    expect(row).not.toHaveProperty("prompt");
    expect(row).not.toHaveProperty("text");
    expect(row).not.toHaveProperty("response");
    expect(JSON.stringify(row)).not.toMatch(/Please reply|email body|secret@/i);
  });
});
