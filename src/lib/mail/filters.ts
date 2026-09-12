import { confidenceBand } from "@/lib/ai/post-process";
import { STALE_WAITING_MS } from "@/lib/dashboard/changes";

export function isUncertainClassification(confidence: number | null | undefined): boolean {
  if (confidence == null || !Number.isFinite(confidence)) {
    return false;
  }
  return confidenceBand(confidence) !== "normal";
}

export function parseUncertainFilter(value: string | string[] | undefined): boolean {
  const raw = Array.isArray(value) ? value[0] : value;
  return raw === "1" || raw === "true";
}

export function isStaleWaiting(updatedAt: string | null | undefined, now: Date = new Date()): boolean {
  if (!updatedAt) {
    return false;
  }
  const updated = Date.parse(updatedAt);
  return Number.isFinite(updated) && updated < now.getTime() - STALE_WAITING_MS;
}
