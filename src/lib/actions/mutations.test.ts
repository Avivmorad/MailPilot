import { describe, expect, it } from "vitest";

import { ActionPatchError, nextActionState } from "@/lib/actions/next-state";
import { actionPatchSchema, type ActionPatch } from "@/lib/actions/patch-schema";
import type { ActionRecord } from "@/lib/actions/reconcile-action";

const base: ActionRecord = {
  status: "OPEN",
  title: "Reply",
  description: "Need a reply",
  actionType: "reply",
  waitingFor: null,
  deadline: null,
  urgency: "soon",
  source: "AI",
  manualOverride: false,
  completedAt: null,
  snoozedUntil: null,
};

describe("nextActionState", () => {
  const now = new Date("2026-09-10T08:00:00.000Z");

  it("marks complete with a manual override", () => {
    const next = nextActionState(base, { op: "complete" } satisfies ActionPatch, now);
    expect(next.status).toBe("COMPLETED");
    expect(next.manualOverride).toBe(true);
    expect(next.completedAt).toBe(now.toISOString());
    expect(next.source).toBe("USER");
  });

  it("snoozes for the chosen number of days", () => {
    const next = nextActionState(base, { op: "snooze", days: 3 }, now);
    expect(next.status).toBe("SNOOZED");
    expect(next.snoozedUntil).toBe("2026-09-13T08:00:00.000Z");
    expect(next.manualOverride).toBe(true);
  });

  it("reopens a completed action", () => {
    const next = nextActionState(
      { ...base, status: "COMPLETED", completedAt: now.toISOString(), manualOverride: true },
      { op: "reopen" },
      now,
    );
    expect(next.status).toBe("OPEN");
    expect(next.completedAt).toBeNull();
  });

  it("undoes a snooze back to open", () => {
    const next = nextActionState(
      {
        ...base,
        status: "SNOOZED",
        snoozedUntil: "2026-09-13T08:00:00.000Z",
        manualOverride: true,
      },
      { op: "reopen" },
      now,
    );
    expect(next.status).toBe("OPEN");
    expect(next.snoozedUntil).toBeNull();
  });

  it("snoozes until a calendar date at noon UTC", () => {
    const next = nextActionState(base, { op: "snooze", until: "2026-09-20" }, now);
    expect(next.status).toBe("SNOOZED");
    expect(next.snoozedUntil).toBe("2026-09-20T12:00:00.000Z");
  });

  it("rejects a snooze date that is not in the allowed window", () => {
    expect(() => nextActionState(base, { op: "snooze", until: "2026-09-10" }, now)).toThrow(
      ActionPatchError,
    );
  });

  it("marks waiting with an editable waiting-for value", () => {
    const next = nextActionState(base, { op: "wait", waitingFor: "the registrar" }, now);
    expect(next.status).toBe("WAITING");
    expect(next.waitingFor).toBe("the registrar");
    expect(next.manualOverride).toBe(true);
  });
});

describe("actionPatchSchema", () => {
  it("accepts either snooze days or a date, not both", () => {
    expect(actionPatchSchema.safeParse({ op: "snooze", days: 3 }).success).toBe(true);
    expect(actionPatchSchema.safeParse({ op: "snooze", until: "2026-09-20" }).success).toBe(true);
    expect(actionPatchSchema.safeParse({ op: "snooze" }).success).toBe(false);
    expect(
      actionPatchSchema.safeParse({ op: "snooze", days: 3, until: "2026-09-20" }).success,
    ).toBe(false);
  });
});
