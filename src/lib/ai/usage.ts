import { z } from "zod";

import { priceUsage, type TriageProviderId } from "@/lib/ai/pricing";
import { createAdminClient } from "@/lib/supabase/admin";

export type UsageSource = "provider" | "absent";

export type NormalizedProviderUsage = {
  inputTokens: number | null;
  outputTokens: number | null;
  reasoningTokens: number | null;
  totalTokens: number | null;
  source: UsageSource;
};

export type GenerateWithUsage = {
  text: string;
  usage: NormalizedProviderUsage;
};

export type TriageUsageOutcome = "ok" | "schema" | "provider_error" | "timeout" | "aborted";

export type ProviderUsageEvent = {
  provider: TriageProviderId;
  model: string;
  attempt: number;
  outcome: TriageUsageOutcome;
  durationMs: number;
  usage: NormalizedProviderUsage;
};

export const ABSENT_USAGE: NormalizedProviderUsage = {
  inputTokens: null,
  outputTokens: null,
  reasoningTokens: null,
  totalTokens: null,
  source: "absent",
};

const nonNegInt = z.number().int().nonnegative();

const nvidiaUsageSchema = z
  .object({
    prompt_tokens: nonNegInt.optional(),
    completion_tokens: nonNegInt.optional(),
    total_tokens: nonNegInt.optional(),
    completion_tokens_details: z
      .object({
        reasoning_tokens: nonNegInt.optional(),
      })
      .optional(),
  })
  .strip();

const geminiUsageSchema = z
  .object({
    promptTokenCount: nonNegInt.optional(),
    candidatesTokenCount: nonNegInt.optional(),
    thoughtsTokenCount: nonNegInt.optional(),
    totalTokenCount: nonNegInt.optional(),
  })
  .strip();

/**
 * Parse NVIDIA OpenAI-compatible `usage`. Never keeps choices, content, or
 * reasoning_content — callers must drop the rest of the response.
 */
export function parseNvidiaUsage(payload: unknown): NormalizedProviderUsage {
  if (!payload || typeof payload !== "object" || !("usage" in payload)) {
    return ABSENT_USAGE;
  }
  const usageValue = (payload as { usage: unknown }).usage;
  if (usageValue == null || typeof usageValue !== "object") {
    return ABSENT_USAGE;
  }
  const parsed = nvidiaUsageSchema.safeParse(usageValue);
  if (!parsed.success) {
    return ABSENT_USAGE;
  }
  return {
    inputTokens: parsed.data.prompt_tokens ?? null,
    outputTokens: parsed.data.completion_tokens ?? null,
    reasoningTokens: parsed.data.completion_tokens_details?.reasoning_tokens ?? null,
    totalTokens: parsed.data.total_tokens ?? null,
    source: "provider",
  };
}

/**
 * Parse Gemini `usageMetadata`. Zod strips modality breakdowns and unknown keys.
 */
export function parseGeminiUsage(usageMetadata: unknown): NormalizedProviderUsage {
  if (usageMetadata == null || typeof usageMetadata !== "object") {
    return ABSENT_USAGE;
  }
  const parsed = geminiUsageSchema.safeParse(usageMetadata);
  if (!parsed.success) {
    return ABSENT_USAGE;
  }
  return {
    inputTokens: parsed.data.promptTokenCount ?? null,
    outputTokens: parsed.data.candidatesTokenCount ?? null,
    reasoningTokens: parsed.data.thoughtsTokenCount ?? null,
    totalTokens: parsed.data.totalTokenCount ?? null,
    source: "provider",
  };
}

export function nvidiaContentFromPayload(payload: unknown): string {
  if (!payload || typeof payload !== "object") {
    return "";
  }
  const choices = (payload as { choices?: unknown }).choices;
  if (!Array.isArray(choices) || choices.length === 0) {
    return "";
  }
  const first = choices[0];
  if (!first || typeof first !== "object") {
    return "";
  }
  const message = (first as { message?: unknown }).message;
  if (!message || typeof message !== "object") {
    return "";
  }
  const content = (message as { content?: unknown }).content;
  return typeof content === "string" ? content : "";
}

export type ScanUsageContext = {
  userId: string;
  connectionId: string;
  scanId: string;
  promptVersion: string;
};

export type TriageUsageRow = {
  user_id: string;
  gmail_connection_id: string;
  scan_id: string;
  provider: TriageProviderId;
  model: string;
  prompt_version: string;
  attempt: number;
  outcome: TriageUsageOutcome;
  usage_source: UsageSource;
  input_tokens: number | null;
  output_tokens: number | null;
  reasoning_tokens: number | null;
  total_tokens: number | null;
  priced_micro_usd: number | null;
  price_table_version: string;
  billable: boolean;
  duration_ms: number;
};

export function buildTriageUsageRow(
  ctx: ScanUsageContext,
  event: ProviderUsageEvent,
): TriageUsageRow {
  const priced = priceUsage(event.provider, event.model, event.usage);
  return {
    user_id: ctx.userId,
    gmail_connection_id: ctx.connectionId,
    scan_id: ctx.scanId,
    provider: event.provider,
    model: event.model,
    prompt_version: ctx.promptVersion,
    attempt: event.attempt,
    outcome: event.outcome,
    usage_source: event.usage.source,
    input_tokens: event.usage.inputTokens,
    output_tokens: event.usage.outputTokens,
    reasoning_tokens: event.usage.reasoningTokens,
    total_tokens: event.usage.totalTokens,
    priced_micro_usd: priced.pricedMicroUsd,
    price_table_version: priced.priceTableVersion,
    billable: priced.billable,
    duration_ms: event.durationMs,
  };
}

/**
 * Best-effort append-only insert. Never throws — a failed write must not abort
 * the scan or skip Gmail labels.
 */
export async function insertTriageUsageRow(row: TriageUsageRow): Promise<void> {
  try {
    const db = createAdminClient();
    const { error } = await db.from("triage_usage").insert(row);
    if (error) {
      console.warn(JSON.stringify({ type: "triage_usage.insert_failed", error_category: "store" }));
    }
  } catch {
    console.warn(JSON.stringify({ type: "triage_usage.insert_failed", error_category: "store" }));
  }
}

export function createScanUsageRecorder(
  ctx: ScanUsageContext,
): (event: ProviderUsageEvent) => Promise<void> {
  return async (event) => {
    await insertTriageUsageRow(buildTriageUsageRow(ctx, event));
  };
}

/** Invoke the optional usage callback without letting failures affect triage. */
export async function emitProviderUsage(
  callback: ((event: ProviderUsageEvent) => void | Promise<void>) | undefined,
  event: ProviderUsageEvent,
): Promise<void> {
  if (!callback) {
    return;
  }
  try {
    await callback(event);
  } catch {
    console.warn(JSON.stringify({ type: "triage_usage.callback_failed", error_category: "store" }));
  }
}

export function usageOutcomeFromProviderError(
  error: unknown,
  signal?: AbortSignal,
): TriageUsageOutcome {
  if (signal?.aborted) {
    return "aborted";
  }
  if (error instanceof Error && /timed out/i.test(error.message)) {
    return "timeout";
  }
  if (
    error &&
    typeof error === "object" &&
    "name" in error &&
    (error as { name?: string }).name === "AbortError"
  ) {
    return "aborted";
  }
  return "provider_error";
}
