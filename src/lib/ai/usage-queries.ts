import { createClient } from "@/lib/supabase/server";

export type UsageDayAggregate = {
  day: string;
  provider: string;
  model: string;
  calls: number;
  okCalls: number;
  inputTokens: number;
  outputTokens: number;
  reasoningTokens: number;
  microUsd: number | null;
  billable: boolean;
};

export type UsageScanAggregate = {
  scanId: string;
  triggerType: string | null;
  startedAt: string | null;
  calls: number;
  okCalls: number;
  absentCalls: number;
  inputTokens: number;
  outputTokens: number;
  reasoningTokens: number;
  microUsd: number | null;
  billable: boolean;
};

type UsageRow = {
  provider: string;
  model: string;
  outcome: string;
  usage_source: string;
  input_tokens: number | null;
  output_tokens: number | null;
  reasoning_tokens: number | null;
  priced_micro_usd: number | null;
  billable: boolean;
  created_at: string;
  scan_id: string;
};

type ScanRunRow = {
  id: string;
  trigger_type: string | null;
  started_at: string | null;
};

function utcDay(iso: string): string {
  return iso.slice(0, 10);
}

function sumNullable(values: Array<number | null>): number {
  return values.reduce<number>((sum, value) => sum + (value ?? 0), 0);
}

function sumMicro(values: Array<number | null>): number | null {
  if (values.every((value) => value == null)) {
    return null;
  }
  return values.reduce<number>((sum, value) => sum + (value ?? 0), 0);
}

/**
 * Last N UTC days of triage_usage, grouped by day / provider / model.
 * Uses the user-scoped Supabase client (RLS select). No email fields.
 */
export async function listUsageByDayForUser(
  userId: string,
  days = 7,
): Promise<UsageDayAggregate[]> {
  const since = new Date();
  since.setUTCDate(since.getUTCDate() - Math.max(1, days));
  const db = await createClient();
  const { data, error } = await db
    .from("triage_usage")
    .select(
      "provider, model, outcome, usage_source, input_tokens, output_tokens, reasoning_tokens, priced_micro_usd, billable, created_at, scan_id",
    )
    .eq("user_id", userId)
    .gte("created_at", since.toISOString())
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error("Failed to load triage usage by day");
  }

  const rows = (data ?? []) as UsageRow[];
  const grouped = new Map<string, UsageRow[]>();
  for (const row of rows) {
    const key = `${utcDay(row.created_at)}|${row.provider}|${row.model}`;
    const bucket = grouped.get(key) ?? [];
    bucket.push(row);
    grouped.set(key, bucket);
  }

  return [...grouped.entries()]
    .map(([key, bucket]) => {
      const [day, provider, model] = key.split("|") as [string, string, string];
      return {
        day,
        provider,
        model,
        calls: bucket.length,
        okCalls: bucket.filter((row) => row.outcome === "ok").length,
        inputTokens: sumNullable(bucket.map((row) => row.input_tokens)),
        outputTokens: sumNullable(bucket.map((row) => row.output_tokens)),
        reasoningTokens: sumNullable(bucket.map((row) => row.reasoning_tokens)),
        microUsd: sumMicro(bucket.map((row) => row.priced_micro_usd)),
        billable: bucket.some((row) => row.billable),
      };
    })
    .sort((a, b) => (a.day < b.day ? 1 : a.day > b.day ? -1 : 0));
}

/**
 * Recent scans with call / token aggregates from triage_usage.
 */
export async function listUsageByScanForUser(
  userId: string,
  limit = 20,
): Promise<UsageScanAggregate[]> {
  const db = await createClient();
  const { data, error } = await db
    .from("triage_usage")
    .select(
      "provider, model, outcome, usage_source, input_tokens, output_tokens, reasoning_tokens, priced_micro_usd, billable, created_at, scan_id",
    )
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(Math.max(limit * 50, 200));

  if (error) {
    throw new Error("Failed to load triage usage by scan");
  }

  const rows = (data ?? []) as UsageRow[];
  const byScan = new Map<string, UsageRow[]>();
  for (const row of rows) {
    if (!byScan.has(row.scan_id) && byScan.size >= limit) {
      continue;
    }
    const bucket = byScan.get(row.scan_id) ?? [];
    bucket.push(row);
    byScan.set(row.scan_id, bucket);
  }

  const scanIds = [...byScan.keys()].slice(0, limit);
  if (scanIds.length === 0) {
    return [];
  }

  const { data: scans, error: scanError } = await db
    .from("scan_runs")
    .select("id, trigger_type, started_at")
    .eq("user_id", userId)
    .in("id", scanIds);

  if (scanError) {
    throw new Error("Failed to load scan runs for usage");
  }

  const scanById = new Map(((scans ?? []) as ScanRunRow[]).map((row) => [row.id, row] as const));

  return scanIds.map((scanId) => {
    const bucket = byScan.get(scanId) ?? [];
    const scan = scanById.get(scanId);
    return {
      scanId,
      triggerType: scan?.trigger_type ?? null,
      startedAt: scan?.started_at ?? null,
      calls: bucket.length,
      okCalls: bucket.filter((row) => row.outcome === "ok").length,
      absentCalls: bucket.filter((row) => row.usage_source === "absent").length,
      inputTokens: sumNullable(bucket.map((row) => row.input_tokens)),
      outputTokens: sumNullable(bucket.map((row) => row.output_tokens)),
      reasoningTokens: sumNullable(bucket.map((row) => row.reasoning_tokens)),
      microUsd: sumMicro(bucket.map((row) => row.priced_micro_usd)),
      billable: bucket.some((row) => row.billable),
    };
  });
}
