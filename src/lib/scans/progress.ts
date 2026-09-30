import { z } from "zod";

/**
 * Advance the saved scan cursor only through a finished prefix.
 * A later thread finishing first must not move the cursor, or the next
 * slice restarts earlier and the progress number falls.
 */
export function advanceContiguousCursor(
  cursor: number,
  finished: Set<number>,
  index: number,
): number {
  finished.add(index);
  let next = cursor;
  while (finished.has(next)) {
    finished.delete(next);
    next += 1;
  }
  return next;
}

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

  // Terminal scans are decided before the empty-discovery branch. An empty
  // SUCCESS used to fall through to the indeterminate "Finding conversations" state.
  if (status === "SUCCESS") {
    if (threadsDiscovered <= 0) {
      return {
        percent: 100,
        label: "No conversations in this window.",
        indeterminate: false,
      };
    }
    return {
      percent: 100,
      label: `Checked ${threadsChecked} of ${threadsDiscovered} conversations (100%)`,
      indeterminate: false,
    };
  }

  if (status === "PARTIAL" || errorCode === "partial_thread_failures") {
    // PARTIAL records failures. It does not prove a retry was queued.
    if (threadsDiscovered <= 0) {
      return {
        percent: 0,
        label: "No conversations were fully processed. Run Scan now again to try again.",
        indeterminate: false,
      };
    }
    const displayPercent = Math.min(95, scanProgressPercent(threadsChecked, threadsDiscovered));
    return {
      percent: displayPercent,
      label: `Checked ${threadsChecked} of ${threadsDiscovered} conversations. Some could not be processed. Run Scan now again to try those.`,
      indeterminate: false,
    };
  }

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

  if (status === "FAILED") {
    if (errorCode === "cancelled") {
      return {
        percent: rawPercent,
        label:
          threadsDiscovered > 0
            ? `Scan stopped after checking ${threadsChecked} of ${threadsDiscovered} conversations.`
            : "Scan stopped before conversations were checked.",
        indeterminate: false,
      };
    }
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
        label: `Checking ${threadsChecked} of ${threadsDiscovered} conversations (${rawPercent}%). Large scans continue automatically…`,
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
  updated_at: z.string().nullable().optional(),
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
