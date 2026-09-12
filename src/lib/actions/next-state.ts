import type { ActionPatch } from "@/lib/actions/patch-schema";
import { MAX_SNOOZE_DAYS } from "@/lib/actions/patch-schema";
import type { ActionRecord } from "@/lib/actions/reconcile-action";
import { daysUntilCalendarDate } from "@/lib/ui/format";

export class ActionPatchError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ActionPatchError";
  }
}

function snoozeUntil(patch: Extract<ActionPatch, { op: "snooze" }>, now: Date): string {
  if (patch.days != null) {
    return new Date(now.getTime() + patch.days * 24 * 60 * 60 * 1000).toISOString();
  }
  const until = patch.until;
  if (!until) {
    throw new ActionPatchError("Snooze requires either days or until.");
  }
  const days = daysUntilCalendarDate(until, now);
  if (days == null || days < 1 || days > MAX_SNOOZE_DAYS) {
    throw new ActionPatchError("Pick a snooze date between tomorrow and 90 days from now.");
  }
  return new Date(`${until}T12:00:00.000Z`).toISOString();
}

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
  if (patch.op === "wait") {
    return {
      ...current,
      status: "WAITING",
      waitingFor: patch.waitingFor,
      manualOverride: true,
      completedAt: null,
      snoozedUntil: null,
      source: "USER",
    };
  }
  return {
    ...current,
    status: "SNOOZED",
    manualOverride: true,
    snoozedUntil: snoozeUntil(patch, now),
    source: "USER",
  };
}
