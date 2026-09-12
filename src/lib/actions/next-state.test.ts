import { describe, expect, it } from "vitest";

import { nextActionState } from "@/lib/actions/next-state";
import type { ActionRecord } from "@/lib/actions/reconcile-action";

const waiting: ActionRecord = {
  status: "WAITING",
  title: "Wait for HR",
  description: null,
  actionType: "follow_up",
  waitingFor: "HR",
  snoozedUntil: null,
  deadline: null,
  urgency: null,
  source: "AI",
  manualOverride: false,
  completedAt: null,
};

describe("nextActionState", () => {
  it("clears waitingFor when reopening from Waiting", () => {
    const next = nextActionState(waiting, { op: "reopen" });
    expect(next.status).toBe("OPEN");
    expect(next.waitingFor).toBeNull();
  });
});
