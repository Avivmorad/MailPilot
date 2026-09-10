import { describe, expect, it } from "vitest";

import { reconcileActionItem, type ActionRecord } from "@/lib/actions/reconcile-action";
import { threadAnalysisSchema, type ThreadAnalysis } from "@/lib/ai/schemas";

function analysis(overrides: Partial<ThreadAnalysis> = {}): ThreadAnalysis {
  return threadAnalysisSchema.parse({
    summary: "סיכום",
    importance: "high",
    importance_reason: "needs a reply",
    status: "action_required",
    requires_action: true,
    requires_reply: true,
    action_type: "reply",
    action_summary: "השב ללקוח",
    action_reason: "שאלה פתוחה",
    waiting_for: null,
    waiting_since: null,
    urgency: "soon",
    deadline: null,
    deadline_text: null,
    category: "work",
    sender_name: "Ada",
    organization: null,
    confidence: 0.9,
    short_display_title: "השב ללקוח",
    ...overrides,
  });
}

function existing(overrides: Partial<ActionRecord> = {}): ActionRecord {
  return {
    status: "OPEN",
    title: "השב ללקוח",
    description: "שאלה פתוחה",
    actionType: "reply",
    waitingFor: null,
    deadline: null,
    urgency: "soon",
    source: "AI",
    manualOverride: false,
    completedAt: null,
    snoozedUntil: null,
    ...overrides,
  };
}

describe("reconcileActionItem", () => {
  it("opens an action for action_required analysis", () => {
    const next = reconcileActionItem({
      analysis: analysis(),
      existing: null,
      latestDirection: "INBOUND",
      latestMessageAt: "2026-09-10T10:00:00.000Z",
    });
    expect(next?.status).toBe("OPEN");
    expect(next?.title).toBe("השב ללקוח");
  });

  it("marks WAITING when analysis status is waiting", () => {
    const next = reconcileActionItem({
      analysis: analysis({
        status: "waiting",
        requires_action: false,
        requires_reply: false,
        action_type: "follow_up",
        waiting_for: "Ada",
        action_summary: "ממתין לאישור",
      }),
      existing: existing(),
      latestDirection: "OUTBOUND",
      latestMessageAt: "2026-09-10T10:00:00.000Z",
    });
    expect(next?.status).toBe("WAITING");
    expect(next?.waitingFor).toBe("Ada");
  });

  it("reopens WAITING to OPEN on a new inbound message that requires action", () => {
    const next = reconcileActionItem({
      analysis: analysis(),
      existing: existing({ status: "WAITING", waitingFor: "Ada" }),
      latestDirection: "INBOUND",
      latestMessageAt: "2026-09-11T10:00:00.000Z",
    });
    expect(next?.status).toBe("OPEN");
  });

  it("does not reopen a manual completion when the latest message is unchanged", () => {
    const completed = existing({
      status: "COMPLETED",
      manualOverride: true,
      completedAt: "2026-09-10T12:00:00.000Z",
    });
    const next = reconcileActionItem({
      analysis: analysis(),
      existing: completed,
      latestDirection: "INBOUND",
      latestMessageAt: "2026-09-10T11:00:00.000Z",
    });
    expect(next).toEqual(completed);
  });

  it("returns null for resolved threads with no existing action", () => {
    const next = reconcileActionItem({
      analysis: analysis({
        status: "resolved",
        requires_action: false,
        requires_reply: false,
        action_type: "none",
        action_summary: null,
        action_reason: null,
        importance: "medium",
      }),
      existing: null,
      latestDirection: "INBOUND",
      latestMessageAt: "2026-09-10T10:00:00.000Z",
    });
    expect(next).toBeNull();
  });

  it("keeps a snoozed action until snoozed_until", () => {
    const snoozed = existing({
      status: "SNOOZED",
      snoozedUntil: "2026-09-12T10:00:00.000Z",
      manualOverride: true,
    });
    const next = reconcileActionItem({
      analysis: analysis(),
      existing: snoozed,
      latestDirection: "INBOUND",
      latestMessageAt: "2026-09-10T10:00:00.000Z",
      now: new Date("2026-09-11T10:00:00.000Z"),
    });
    expect(next).toEqual(snoozed);
  });

  it("closes an OPEN action when analysis becomes ignore", () => {
    const next = reconcileActionItem({
      analysis: analysis({
        status: "ignore",
        requires_action: false,
        requires_reply: false,
        action_type: "none",
        action_summary: null,
        importance: "low",
      }),
      existing: existing(),
      latestDirection: "INBOUND",
      latestMessageAt: "2026-09-10T12:00:00.000Z",
    });
    expect(next?.status).toBe("COMPLETED");
  });
});
