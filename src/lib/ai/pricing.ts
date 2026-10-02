import type { NormalizedProviderUsage } from "@/lib/ai/usage";

export type TriageProviderId = "nvidia" | "gemini";

export const PRICE_TABLE_VERSION = "2026-10-02-free";

export type PriceRow = {
  /** Micro-USD per 1M input tokens (millionths of a dollar). */
  inputMicroUsdPerMillion: number;
  /** Micro-USD per 1M output tokens (includes thinking for Gemini). */
  outputMicroUsdPerMillion: number;
  billable: boolean;
};

/**
 * Operator-owned price table. Both configured keys are free-tier as of
 * 2026-10-02, so micro-USD is 0 and billable is false. Token columns remain
 * the capacity signal. Switch a row when a key leaves the free tier.
 */
const PRICE_ROWS: Record<TriageProviderId, Record<string, PriceRow>> = {
  nvidia: {
    "openai/gpt-oss-20b": {
      inputMicroUsdPerMillion: 0,
      outputMicroUsdPerMillion: 0,
      billable: false,
    },
  },
  gemini: {
    "gemini-3.1-flash-lite": {
      inputMicroUsdPerMillion: 0,
      outputMicroUsdPerMillion: 0,
      billable: false,
    },
  },
};

export function lookupPriceRow(provider: TriageProviderId, model: string): PriceRow | null {
  return PRICE_ROWS[provider]?.[model] ?? null;
}

export type PricedUsage = {
  pricedMicroUsd: number | null;
  billable: boolean;
  priceTableVersion: string;
};

/**
 * Price provider-reported tokens. Unknown models leave priced_micro_usd null.
 * NVIDIA reasoning tokens are already inside completion_tokens — do not add
 * them again. Gemini output = candidates + thoughts.
 */
export function priceUsage(
  provider: TriageProviderId,
  model: string,
  usage: NormalizedProviderUsage,
): PricedUsage {
  const row = lookupPriceRow(provider, model);
  if (!row) {
    return {
      pricedMicroUsd: null,
      billable: false,
      priceTableVersion: PRICE_TABLE_VERSION,
    };
  }
  if (usage.source !== "provider" || usage.inputTokens == null) {
    return {
      pricedMicroUsd: null,
      billable: row.billable,
      priceTableVersion: PRICE_TABLE_VERSION,
    };
  }

  const inputTokens = usage.inputTokens;
  const outputTokens =
    provider === "gemini"
      ? (usage.outputTokens ?? 0) + (usage.reasoningTokens ?? 0)
      : usage.outputTokens;
  if (outputTokens == null) {
    return {
      pricedMicroUsd: null,
      billable: row.billable,
      priceTableVersion: PRICE_TABLE_VERSION,
    };
  }

  const pricedMicroUsd = Math.round(
    (inputTokens * row.inputMicroUsdPerMillion) / 1_000_000 +
      (outputTokens * row.outputMicroUsdPerMillion) / 1_000_000,
  );

  return {
    pricedMicroUsd,
    billable: row.billable,
    priceTableVersion: PRICE_TABLE_VERSION,
  };
}
