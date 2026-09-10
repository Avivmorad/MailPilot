import { describe, expect, it } from "vitest";

import { threadAnalysisSchema, type ThreadAnalysis } from "@/lib/ai/schemas";
import { labelDiff, logicalLabelsForAnalysis } from "@/lib/gmail/label-plan";

function analysis(overrides: Partial<ThreadAnalysis> = {}): ThreadAnalysis {
  return threadAnalysisSchema.parse({
    summary: "סיכום",
    importance: "medium",
    importance_reason: "routine",
    status: "informational",
    requires_action: false,
    requires_reply: false,
    action_type: "none",
    action_summary: null,
    action_reason: null,
    waiting_for: null,
    waiting_since: null,
    urgency: "normal",
    deadline: null,
    deadline_text: null,
    category: "other",
    sender_name: null,
    organization: null,
    confidence: 0.7,
    short_display_title: "כותרת",
    ...overrides,
  });
}

describe("logicalLabelsForAnalysis", () => {
  it("always includes processed", () => {
    expect(logicalLabelsForAnalysis(analysis())).toEqual(["processed"]);
  });

  it("adds important and action_required for high-priority action threads", () => {
    expect(
      logicalLabelsForAnalysis(
        analysis({
          importance: "high",
          status: "action_required",
          requires_action: true,
          action_type: "reply",
          action_summary: "השב",
          action_reason: "שאלה",
        }),
      ),
    ).toEqual(["important", "action_required", "processed"]);
  });

  it("adds low_priority for ignore and for low importance without action", () => {
    expect(logicalLabelsForAnalysis(analysis({ status: "ignore", importance: "low" }))).toEqual([
      "low_priority",
      "processed",
    ]);
    expect(logicalLabelsForAnalysis(analysis({ importance: "low" }))).toEqual(["low_priority", "processed"]);
  });

  it("does not add low_priority when a low-importance thread still requires action", () => {
    expect(
      logicalLabelsForAnalysis(
        analysis({
          importance: "low",
          status: "action_required",
          requires_action: true,
          action_type: "review",
          action_summary: "בדוק",
          action_reason: "טופס",
        }),
      ),
    ).toEqual(["action_required", "processed"]);
  });
});

describe("labelDiff", () => {
  it("adds missing ids and removes extras without touching unchanged ones", () => {
    expect(labelDiff(["a", "b"], ["b", "c"])).toEqual({
      addLabelIds: ["c"],
      removeLabelIds: ["a"],
    });
  });

  it("is a no-op when current and desired match", () => {
    expect(labelDiff(["a", "b"], ["a", "b"])).toEqual({
      addLabelIds: [],
      removeLabelIds: [],
    });
  });
});
