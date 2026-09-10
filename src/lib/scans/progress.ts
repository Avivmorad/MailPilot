import { z } from "zod";

export function scanProgressPercent(checked: number, total: number): number {
  if (total <= 0) {
    return 0;
  }
  return Math.min(100, Math.round((checked / total) * 100));
}

export function scanProgressView(input: {
  threadsDiscovered: number;
  threadsChecked: number;
}): { percent: number; label: string; indeterminate: boolean } {
  if (input.threadsDiscovered <= 0) {
    return {
      percent: 0,
      label: "Finding conversations in Gmail…",
      indeterminate: true,
    };
  }
  const percent = scanProgressPercent(input.threadsChecked, input.threadsDiscovered);
  return {
    percent,
    label: `Checked ${input.threadsChecked} of ${input.threadsDiscovered} conversations (${percent}%)`,
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
} {
  return {
    threadsDiscovered: scan.threads_discovered ?? 0,
    threadsChecked: scan.threads_checked ?? 0,
  };
}
