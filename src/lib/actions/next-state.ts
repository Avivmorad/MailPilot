import type { ActionPatch } from "@/lib/actions/patch-schema";
import type { ActionRecord } from "@/lib/actions/reconcile-action";

export function nextActionState(
  current: ActionRecord,
  patch: ActionPatch,
  now: Date = new Date(),
): ActionRecord {
  if (patch.op === "complete") {
    return {
      ...current,
      status: "COMPLETED",
      manualOverride: true,
      completedAt: now.toISOString(),
      snoozedUntil: null,
      source: "USER",
    };
  }
  if (patch.op === "reopen") {
    return {
      ...current,
      status: "OPEN",
      manualOverride: true,
      completedAt: null,
      snoozedUntil: null,
      source: "USER",
    };
  }
  const until = new Date(now.getTime() + patch.days * 24 * 60 * 60 * 1000);
  return {
    ...current,
    status: "SNOOZED",
    manualOverride: true,
    snoozedUntil: until.toISOString(),
    source: "USER",
  };
}
