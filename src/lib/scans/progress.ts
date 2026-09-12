import { z } from "zod";

export function scanProgressPercent(checked: number, total: number): number {
  if (total <= 0) {
    return 0;
  }
  return Math.min(100, Math.max(0, Math.round((checked / total) * 100)));
}

export interface ScanProgressInput {
  threadsDiscovered: number;
  threadsChecked: number;
  status?: string | null;
  errorCode?: string | null;
}

export function scanProgressView(input: ScanProgressInput): {
  percent: number;
  label: string;
  indeterminate: boolean;
} {
  const { threadsDiscovered, threadsChecked, status, errorCode } = input;

  if (threadsDiscovered <= 0) {
    if (status === "FAILED") {
      return {
        percent: 0,
        label: "Scan stopped before conversations were checked.",
        indeterminate: false,
      };
    }
    return {
      percent: 0,
      label:
        status === "RUNNING"
          ? "Discovering conversations in Gmail…"
          : "Finding conversations in Gmail…",
      indeterminate: true,
    };
  }

  const rawPercent = scanProgressPercent(threadsChecked, threadsDiscovered);

  if (status === "PARTIAL" || errorCode === "partial_thread_failures") {
    // Avoid claiming 100% when retry work remains
    const displayPercent = Math.min(95, rawPercent);
    return {
      percent: displayPercent,
      label: `Checked ${threadsChecked} of ${threadsDiscovered} conversations (partially completed, retries queued)`,
      indeterminate: false,
    };
  }

  if (status === "FAILED") {
    if (errorCode === "gmail_quota") {
      return {
        percent: rawPercent,
        label: `Paused due to Gmail rate limit after ${threadsChecked} of ${threadsDiscovered} conversations.`,
        indeterminate: false,
      };
    }
    if (errorCode === "ai_unavailable") {
      return {
        percent: rawPercent,
        label: `Paused due to AI service unavailability after ${threadsChecked} of ${threadsDiscovered} conversations.`,
        indeterminate: false,
      };
    }
    if (errorCode === "reauth_required") {
      return {
        percent: rawPercent,
        label: `Paused: Gmail reconnect required after ${threadsChecked} of ${threadsDiscovered} conversations.`,
        indeterminate: false,
      };
    }
    return {
      percent: rawPercent,
      label: `Scan stopped after checking ${threadsChecked} of ${threadsDiscovered} conversations.`,
      indeterminate: false,
    };
  }

  if (status === "RUNNING") {
    if (threadsChecked === 0) {
      return {
        percent: 0,
        label: `Discovered ${threadsDiscovered} conversations; fetching and triaging…`,
        indeterminate: false,
      };
    }
    if (threadsChecked < threadsDiscovered) {
      return {
        percent: rawPercent,
        label: `Checking ${threadsChecked} of ${threadsDiscovered} conversations (${rawPercent}%)…`,
        indeterminate: false,
      };
    }
    // All checked, finalizing labels and summaries before completion
    return {
      percent: 99,
      label: `Finalizing triage and labels for ${threadsDiscovered} conversations…`,
      indeterminate: false,
    };
  }

  if (status === "SUCCESS") {
    return {
      percent: 100,
      label: `Checked ${threadsChecked} of ${threadsDiscovered} conversations (100%)`,
      indeterminate: false,
    };
  }

  return {
    percent: rawPercent,
    label: `Checked ${threadsChecked} of ${threadsDiscovered} conversations (${rawPercent}%)`,
    indeterminate: false,
  };
}

export const scanRunSnapshotSchema = z.object({
  id: z.string(),
  status: z.string(),
  threads_discovered: z.coerce.number().int().nonnegative().nullable().optional(),
  threads_checked: z.coerce.number().int().nonnegative().nullable().optional(),
  error_code: z.string().nullable().optional(),
  error_message: z.string().nullable().optional(),
});

export const startScanResponseSchema = z.object({
  scanId: z.string(),
  status: z.string(),
});

export const latestScanResponseSchema = z.object({
  scan: scanRunSnapshotSchema.nullable(),
});

export type ScanRunSnapshot = z.infer<typeof scanRunSnapshotSchema>;

export function snapshotProgress(scan: ScanRunSnapshot): {
  threadsDiscovered: number;
  threadsChecked: number;
  status: string | null;
  errorCode: string | null;
} {
  return {
    threadsDiscovered: scan.threads_discovered ?? 0,
    threadsChecked: scan.threads_checked ?? 0,
    status: scan.status ?? null,
    errorCode: scan.error_code ?? null,
  };
}
