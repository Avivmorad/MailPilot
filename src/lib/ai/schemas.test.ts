import { describe, expect, it } from "vitest";

import { threadAnalysisSchema } from "@/lib/ai/schemas";

describe("threadAnalysisSchema", () => {
  it("rejects unknown keys", () => {
    const parsed = threadAnalysisSchema.safeParse({
      summary: "סיכום",
      importance: "low",
      importance_reason: "n",
      status: "ignore",
      requires_action: false,
      requires_reply: false,
      action_type: "none",
      action_summary: null,
      action_reason: null,
      waiting_for: null,
      waiting_since: null,
      urgency: "none",
      deadline: null,
      deadline_text: null,
      category: "promotion",
      sender_name: null,
      organization: null,
      confidence: 0.5,
      short_display_title: "כותרת",
      extra: true,
    });
    expect(parsed.success).toBe(false);
  });

  it("rejects a non-ISO deadline string", () => {
    const parsed = threadAnalysisSchema.safeParse({
      summary: "סיכום",
      importance: "low",
      importance_reason: "n",
      status: "informational",
      requires_action: false,
      requires_reply: false,
      action_type: "none",
      action_summary: null,
      action_reason: null,
      waiting_for: null,
      waiting_since: null,
      urgency: "none",
      deadline: "tomorrow",
      deadline_text: "tomorrow",
      category: "other",
      sender_name: null,
      organization: null,
      confidence: 0.5,
      short_display_title: "כותרת",
    });
    expect(parsed.success).toBe(false);
  });
});
