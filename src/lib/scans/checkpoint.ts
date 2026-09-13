import { isInitialLookbackDays, type InitialLookbackDays } from "@/lib/scans/lookback";
import type { ScanDiscoveryMode, ScanCheckpoint } from "@/lib/scans/types";

export function parseJsonStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((item): item is string => typeof item === "string" && item.length > 0);
}

export function asLookbackDays(value: unknown, fallback: InitialLookbackDays = 7): InitialLookbackDays {
  const n = typeof value === "number" ? value : Number(value);
  return isInitialLookbackDays(n) ? n : fallback;
}

export function asDiscoveryMode(value: unknown): ScanDiscoveryMode | null {
  if (value === "INITIAL" || value === "INCREMENTAL" || value === "RECOVERY") {
    return value;
  }
  return null;
}

export function scanHasRemainingWork(checkpoint: ScanCheckpoint): boolean {
  if (!checkpoint.discoveryComplete) {
    return true;
  }
  return checkpoint.threadCursor < checkpoint.discoveredThreadIds.length;
}

export function progressAgeMs(checkpoint: { updatedAt: string | null; startedAt: string | null }, nowMs: number): number {
  const stamp = checkpoint.updatedAt ?? checkpoint.startedAt;
  const parsed = stamp ? Date.parse(stamp) : NaN;
  if (!Number.isFinite(parsed)) {
    return Number.POSITIVE_INFINITY;
  }
  return nowMs - parsed;
}
