import { describe, expect, it } from "vitest";

import {
  assertThreadAnalysisInvariants,
  confidenceBand,
  postProcessThreadAnalysis,
} from "@/lib/ai/post-process";
import type { ThreadAnalysis } from "@/lib/ai/schemas";

function analysis(overrides: Partial<ThreadAnalysis> = {}): ThreadAnalysis {
  return {
    summary: "סיכום",
    importance: "medium",
    importance_reason: "reason",
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
    category: "work",
    sender_name: null,
    organization: null,
    confidence: 0.9,
    short_display_title: "כותרת",
    ...overrides,
  };
}

describe("postProcessThreadAnalysis", () => {
  it("enforces Rule A for action_required", () => {
    const processed = postProcessThreadAnalysis(
      analysis({
        status: "action_required",
        requires_action: false,
        action_type: "review",
        action_summary: null,
      }),
    );

    expect(processed.requires_action).toBe(true);
    expect(processed.action_summary).toBe("בדוק את המייל");
    expect(() => assertThreadAnalysisInvariants(processed)).not.toThrow();
  });

  it("enforces Rule B for waiting", () => {
    const processed = postProcessThreadAnalysis(
      analysis({
        status: "waiting",
        requires_action: true,
        action_type: "reply",
        waiting_for: null,
      }),
    );

    expect(processed.requires_action).toBe(false);
    expect(processed.action_type).toBe("none");
    expect(processed.waiting_for).toBe("the other party");
  });

  it("enforces Rule C for requires_reply", () => {
    const processed = postProcessThreadAnalysis(
      analysis({
        requires_reply: true,
        requires_action: false,
        action_type: "review",
        status: "action_required",
        action_summary: "השב",
      }),
    );

    expect(processed.requires_action).toBe(true);
    expect(processed.action_type).toBe("reply");
  });

  it("drops invented or invalid deadlines (Rule D)", () => {
    const processed = postProcessThreadAnalysis(analysis({ deadline: "tomorrow" }));
    expect(processed.deadline).toBeNull();
    expect(postProcessThreadAnalysis(analysis({ deadline: "2026-02-30" })).deadline).toBeNull();
    expect(postProcessThreadAnalysis(analysis({ deadline: "2026-09-18" })).deadline).toBe("2026-09-18");
  });

  it("clamps confidence (Rule E)", () => {
    expect(postProcessThreadAnalysis(analysis({ confidence: 1.4 })).confidence).toBe(1);
    expect(postProcessThreadAnalysis(analysis({ confidence: -0.2 })).confidence).toBe(0);
  });

  it("applies VIP and ignore sender overrides", () => {
    const ignored = postProcessThreadAnalysis(analysis({ importance: "medium", category: "work" }), {
      latestFrom: "Ada <noise@example.com>",
      preferences: { ignoreSenders: ["noise@example.com"] },
    });
    expect(ignored.status).toBe("ignore");
    expect(ignored.importance).toBe("low");

    const vip = postProcessThreadAnalysis(analysis({ importance: "low" }), {
      latestFrom: "vip@example.com",
      preferences: { vipSenders: ["vip@example.com"] },
    });
    expect(vip.importance).toBe("medium");

    const vipHigh = postProcessThreadAnalysis(analysis({ importance: "low" }), {
      latestFrom: "vip@example.com",
      preferences: { vipSenders: ["vip@example.com"], vipAlwaysHigh: true },
    });
    expect(vipHigh.importance).toBe("high");
  });

  it("does not ignore a critical account message", () => {
    const processed = postProcessThreadAnalysis(
      analysis({
        category: "account",
        importance: "high",
        status: "action_required",
        requires_action: true,
        action_type: "review",
        action_summary: "אבטח את החשבון",
      }),
      {
        latestFrom: "alerts@example.com",
        preferences: { ignoreSenders: ["alerts@example.com"] },
      },
    );
    expect(processed.status).toBe("action_required");
    expect(processed.importance).toBe("high");
  });
});

describe("confidenceBand", () => {
  it("maps spec thresholds", () => {
    expect(confidenceBand(0.81)).toBe("normal");
    expect(confidenceBand(0.7)).toBe("low");
    expect(confidenceBand(0.4)).toBe("needs_review");
  });
});
