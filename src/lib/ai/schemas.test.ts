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
      category: "newsletters_promotions",
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

  it("accepts the current category taxonomy and rejects legacy values", () => {
    const base = {
      summary: "סיכום",
      importance: "low" as const,
      importance_reason: "n",
      status: "informational" as const,
      requires_action: false,
      requires_reply: false,
      action_type: "none" as const,
      action_summary: null,
      action_reason: null,
      waiting_for: null,
      waiting_since: null,
      urgency: "none" as const,
      deadline: null,
      deadline_text: null,
      sender_name: null,
      organization: null,
      confidence: 0.5,
      short_display_title: "כותרת",
    };
    expect(threadAnalysisSchema.safeParse({ ...base, category: "career" }).success).toBe(true);
    expect(threadAnalysisSchema.safeParse({ ...base, category: "official_legal" }).success).toBe(true);
    expect(threadAnalysisSchema.safeParse({ ...base, category: "work" }).success).toBe(false);
    expect(threadAnalysisSchema.safeParse({ ...base, category: "account" }).success).toBe(false);
  });
});
