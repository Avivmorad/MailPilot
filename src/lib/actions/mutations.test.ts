import { describe, expect, it } from "vitest";

import { nextActionState } from "@/lib/actions/next-state";
import type { ActionPatch } from "@/lib/actions/patch-schema";
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
});
