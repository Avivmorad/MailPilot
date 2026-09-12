import { describe, expect, it } from "vitest";

import {
  EVAL_THRESHOLDS,
  formatScorecardReport,
  runDeterministicScorecard,
  scorePrediction,
  summarizeScorecard,
} from "@/lib/ai/eval-scorecard";
import { loadEvalCases } from "@/lib/ai/eval-fixtures";
import { postProcessThreadAnalysis } from "@/lib/ai/post-process";

describe("eval scorecard", () => {
  it("meets curated MVP thresholds on the confused-model + post-process pipeline", async () => {
    const scorecard = await runDeterministicScorecard();
    const report = formatScorecardReport(scorecard);

    expect(scorecard.caseCount, report).toBeGreaterThanOrEqual(50);
    expect(scorecard.schemaValidity, report).toBe(EVAL_THRESHOLDS.schemaValidity);
    expect(scorecard.actionRecall, report).toBeGreaterThanOrEqual(EVAL_THRESHOLDS.actionRecall);
    expect(scorecard.deadlineHallucinationRate, report).toBe(EVAL_THRESHOLDS.deadlineHallucination);
    expect(scorecard.securityFalseNegativeRate, report).toBe(0);
  });

  it("charges more for missing a security action than for an extra newsletter task", () => {
    const securityCase = loadEvalCases()[0];
    expect(securityCase).toBeDefined();
    const locked: typeof securityCase = {
      ...securityCase!,
      id: "synthetic_locked_account",
      messages: [
        {
          from: "security@example.com",
          to: "me@example.com",
          subject: "Your account is locked",
          body: "Unauthorized access detected. Reset your password to unlock the account.",
          direction: "INBOUND",
        },
      ],
      expected: {
        importance: "high",
        action_type: "review",
        requires_action: true,
        requires_reply: false,
        status: "action_required",
        deadline: null,
        summary: "Unlock the account",
      },
    };
    const newsletter = loadEvalCases().find((evalCase) => evalCase.id.includes("newsletter"));
    expect(newsletter).toBeDefined();
    if (!newsletter) {
      return;
    }

    const missedSecurity = scorePrediction(locked, null);
    const extraNewsletter = scorePrediction(
      newsletter,
      postProcessThreadAnalysis({
        summary: "Newsletter",
        importance: "low",
        importance_reason: "promo",
        status: "action_required",
        requires_action: true,
        requires_reply: false,
        action_type: "review",
        action_summary: "Read newsletter",
        action_reason: "noise",
        waiting_for: null,
        waiting_since: null,
        urgency: "none",
        deadline: null,
        deadline_text: null,
        category: "other",
        sender_name: null,
        organization: null,
        confidence: 0.4,
        short_display_title: "Newsletter",
      }),
    );

    expect(missedSecurity.riskLoss).toBeGreaterThan(extraNewsletter.riskLoss);
    expect(summarizeScorecard([missedSecurity, extraNewsletter]).riskWeightedLoss).toBe(
      missedSecurity.riskLoss + extraNewsletter.riskLoss,
    );
  });
});
