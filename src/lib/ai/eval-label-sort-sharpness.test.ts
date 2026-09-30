import { describe, expect, it } from "vitest";

import { compareOpenActions } from "@/lib/actions/sort";
import { analyzeThread, type EmailTriageProvider } from "@/lib/ai/analyze-thread";
import {
  confusedTriageProvider,
  evalCaseToInput,
  runDeterministicScorecard,
} from "@/lib/ai/eval-scorecard";
import { goldAnalysisForEvalCase, loadEvalCases } from "@/lib/ai/eval-fixtures";
import type { ThreadAnalysis } from "@/lib/ai/schemas";
import { labelDiff, logicalLabelsForAnalysis } from "@/lib/gmail/label-plan";
import type { MailPilotLogicalLabel } from "@/lib/gmail/constants";
import { assertExclusiveMailBuckets, mailBucketForThread } from "@/lib/mail/buckets";

const LABEL_IDS: Record<MailPilotLogicalLabel, string> = {
  important: "L_IMP",
  action_required: "L_ACT",
  low_priority: "L_LOW",
  processed: "L_PROC",
};

/** Every thread looks informational until notice rules separate the buckets. */
function flatLowConfidenceProvider(): EmailTriageProvider {
  return {
    async analyzeThread(input) {
      const title = input.latestSubject?.trim() || "Email";
      const analysis: ThreadAnalysis = {
        summary: title,
        importance: "low",
        importance_reason: "Flat low-confidence baseline",
        status: "informational",
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
        category: "other",
        sender_name: null,
        organization: null,
        confidence: 0.42,
        short_display_title: title.slice(0, 80),
      };
      return analysis;
    },
  };
}

describe("eval label assignment", () => {
  it("maps gold analyses to the logical MailPilot label plan", () => {
    const cases = loadEvalCases();
    expect(cases.length).toBeGreaterThanOrEqual(50);

    for (const evalCase of cases) {
      const analysis = goldAnalysisForEvalCase(evalCase);
      const logical = logicalLabelsForAnalysis(analysis);
      expect(logical).toContain("processed");

      if (analysis.requires_action || analysis.status === "action_required") {
        expect(logical, evalCase.id).toContain("action_required");
        expect(logical, evalCase.id).not.toContain("low_priority");
      }
      if (analysis.status === "waiting") {
        expect(logical, evalCase.id).not.toContain("low_priority");
        expect(logical, evalCase.id).not.toContain("action_required");
      } else if (
        analysis.status === "ignore" ||
        (analysis.importance === "low" && !analysis.requires_action)
      ) {
        expect(logical, evalCase.id).toContain("low_priority");
      }
      if (analysis.importance === "high") {
        expect(logical).toContain("important");
      }

      const desiredIds = logical.map((name) => LABEL_IDS[name]);
      const diff = labelDiff(["L_PROC", "L_LOW"], desiredIds);
      for (const id of desiredIds) {
        expect(diff.removeLabelIds).not.toContain(id);
      }
    }
  });

  it("keeps actionable fixtures out of ignore-only labels after post-process", async () => {
    const provider = confusedTriageProvider();
    const actionable = loadEvalCases().filter((row) => row.expected.requires_action);
    expect(actionable.length).toBeGreaterThan(5);

    for (const evalCase of actionable.slice(0, 12)) {
      const predicted = await analyzeThread(evalCaseToInput(evalCase), provider);
      const labels = logicalLabelsForAnalysis(predicted);
      expect(labels).toContain("action_required");
      expect(labels).not.toContain("low_priority");
    }
  });
});

describe("eval action sort", () => {
  it("orders by urgency, then deadline presence/date, then importance, then recency", () => {
    const items = [
      {
        id: "older-normal",
        urgency: "normal",
        deadline: null,
        importance: "high",
        latestMessageAt: "2026-09-01T12:00:00.000Z",
      },
      {
        id: "urgent-no-deadline",
        urgency: "urgent",
        deadline: null,
        importance: "low",
        latestMessageAt: "2026-08-01T12:00:00.000Z",
      },
      {
        id: "soon-early-deadline",
        urgency: "soon",
        deadline: "2026-09-11",
        importance: "medium",
        latestMessageAt: "2026-09-09T12:00:00.000Z",
      },
      {
        id: "soon-late-deadline",
        urgency: "soon",
        deadline: "2026-09-20",
        importance: "high",
        latestMessageAt: "2026-09-10T12:00:00.000Z",
      },
      {
        id: "normal-with-deadline",
        urgency: "normal",
        deadline: "2026-09-12",
        importance: "low",
        latestMessageAt: "2026-09-08T12:00:00.000Z",
      },
      {
        id: "tie-newer",
        urgency: "none",
        deadline: null,
        importance: "low",
        latestMessageAt: "2026-09-15T12:00:00.000Z",
      },
      {
        id: "tie-older",
        urgency: "none",
        deadline: null,
        importance: "low",
        latestMessageAt: "2026-09-14T12:00:00.000Z",
      },
    ];

    const sorted = [...items].sort(compareOpenActions);
    expect(sorted.map((row) => row.id)).toEqual([
      "urgent-no-deadline",
      "soon-early-deadline",
      "soon-late-deadline",
      "normal-with-deadline",
      "older-normal",
      "tie-newer",
      "tie-older",
    ]);
  });

  it("treats missing deadlines as lower priority than dated peers at the same urgency", () => {
    const withDeadline = {
      urgency: "normal",
      deadline: "2026-09-12",
      importance: "low",
      latestMessageAt: "2026-09-01T00:00:00.000Z",
    };
    const withoutDeadline = {
      urgency: "normal",
      deadline: null,
      importance: "high",
      latestMessageAt: "2026-09-20T00:00:00.000Z",
    };
    expect(compareOpenActions(withDeadline, withoutDeadline)).toBeLessThan(0);
    const tie = {
      urgency: "soon" as const,
      deadline: "2026-09-11",
      importance: "high" as const,
      latestMessageAt: "2026-09-01T00:00:00.000Z",
    };
    expect(compareOpenActions(tie, { ...tie })).toBe(0);
    expect(compareOpenActions({ ...tie, urgency: null }, { ...tie, urgency: "none" })).toBe(0);
    expect(
      compareOpenActions(
        { ...tie, latestMessageAt: null },
        { ...tie, latestMessageAt: "2026-09-01T00:00:00.000Z" },
      ),
    ).toBeGreaterThan(0);
  });
});

describe("eval classification sharpness", () => {
  it("does not collapse curated fixtures into a single status bucket", async () => {
    const scorecard = await runDeterministicScorecard();
    const statuses = new Set(
      scorecard.cases.map((row) => {
        if (row.predictedAction) return "action";
        if (row.predictedWaiting) return "waiting";
        if (row.predictedIgnore) return "ignore";
        return "informational_or_other";
      }),
    );
    expect(statuses.has("action")).toBe(true);
    expect(statuses.has("ignore")).toBe(true);
    expect(statuses.size).toBeGreaterThanOrEqual(3);
  });

  it("keeps gold action vs ignore analyses in distinct label buckets", () => {
    const cases = loadEvalCases();
    const actions = cases.filter((row) => row.expected.requires_action).slice(0, 12);
    const ignores = cases.filter((row) => row.expected.status === "ignore").slice(0, 12);
    expect(actions.length).toBeGreaterThan(5);
    expect(ignores.length).toBeGreaterThan(5);

    for (const evalCase of actions) {
      const analysis = goldAnalysisForEvalCase(evalCase);
      expect(analysis.requires_action, evalCase.id).toBe(true);
      expect(logicalLabelsForAnalysis(analysis), evalCase.id).toContain("action_required");
      expect(logicalLabelsForAnalysis(analysis), evalCase.id).not.toContain("low_priority");
    }

    for (const evalCase of ignores) {
      const analysis = goldAnalysisForEvalCase(evalCase);
      expect(analysis.requires_action, evalCase.id).toBe(false);
      expect(logicalLabelsForAnalysis(analysis), evalCase.id).toContain("low_priority");
      expect(logicalLabelsForAnalysis(analysis), evalCase.id).not.toContain("action_required");
    }
  });

  it("splits a low-confidence flat model across action, waiting, informational, and ignore", async () => {
    const cases = loadEvalCases();
    const byId = new Map(cases.map((evalCase) => [evalCase.id, evalCase]));
    const required = [
      "case_002_invoice_to_pay",
      "case_001_reply_by_tomorrow",
      "case_006_meeting_reschedule",
      "case_016_job_interview",
      "case_056_account_locked",
      "case_069_docusign_automated_sign",
      "case_054_otp_english",
      "case_003_payment_confirmation",
      "case_005_promotion",
      "case_073_job_alert_ignore",
      "case_059_out_of_office_waiting",
      "case_051_drive_document_share",
      "case_052_hebrew_unpaid_invoice",
    ];
    const provider = flatLowConfidenceProvider();
    const rows: Array<{
      id: string;
      predicted: ThreadAnalysis;
      bucket: ReturnType<typeof mailBucketForThread>;
    }> = [];
    for (const id of required) {
      const evalCase = byId.get(id);
      expect(evalCase, id).toBeDefined();
      if (!evalCase) continue;
      const predicted = await analyzeThread(evalCaseToInput(evalCase), provider);
      rows.push({ id, predicted, bucket: mailBucketForThread({ status: predicted.status }) });
    }

    const securityFooter = await analyzeThread(
      evalCaseToInput({
        id: "synthetic_security_unsubscribe",
        userEmails: ["me@example.com"],
        messages: [
          {
            from: "security@account.example",
            to: "me@example.com",
            subject: "Your account is locked",
            body: "The account is locked until you reset your password. Unsubscribe from security tips.",
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
          summary: "Locked account",
        },
      }),
      provider,
    );
    const mixedInvoice = await analyzeThread(
      evalCaseToInput({
        id: "synthetic_promo_unpaid",
        userEmails: ["me@example.com"],
        messages: [
          {
            from: "billing@finance.example",
            to: "me@example.com",
            subject: "Invoice #9911 unpaid",
            body: "50% off if you unsubscribe. Invoice #9911 is unpaid. Remaining balance 220. Please pay.",
            direction: "INBOUND",
          },
        ],
        expected: {
          importance: "high",
          action_type: "pay",
          requires_action: true,
          requires_reply: false,
          status: "action_required",
          deadline: null,
          summary: "Unpaid invoice",
        },
      }),
      provider,
    );

    const statusOf = (id: string) => rows.find((row) => row.id === id)?.predicted.status;
    expect(statusOf("case_002_invoice_to_pay")).toBe("action_required");
    expect(rows.find((row) => row.id === "case_002_invoice_to_pay")?.predicted.action_type).toBe(
      "pay",
    );
    expect(statusOf("case_052_hebrew_unpaid_invoice")).toBe("action_required");
    expect(statusOf("case_001_reply_by_tomorrow")).toBe("action_required");
    expect(statusOf("case_006_meeting_reschedule")).toBe("action_required");
    expect(statusOf("case_016_job_interview")).toBe("action_required");
    expect(statusOf("case_056_account_locked")).toBe("action_required");
    expect(
      rows.find((row) => row.id === "case_069_docusign_automated_sign")?.predicted.action_type,
    ).toBe("sign");
    expect(securityFooter.status).toBe("action_required");
    expect(securityFooter.requires_action).toBe(true);
    expect(mixedInvoice.status).toBe("action_required");
    expect(mixedInvoice.action_type).toBe("pay");

    for (const id of [
      "case_054_otp_english",
      "case_003_payment_confirmation",
      "case_005_promotion",
      "case_073_job_alert_ignore",
    ]) {
      const row = rows.find((item) => item.id === id);
      expect(row?.predicted.requires_action, id).toBe(false);
      expect(row?.predicted.status, id).toBe("ignore");
      expect(row?.bucket, id).toBe("ignored");
      const labels = logicalLabelsForAnalysis(row!.predicted);
      expect(labels, id).toContain("low_priority");
      expect(labels, id).not.toContain("action_required");
    }

    const waiting = rows.find((row) => row.id === "case_059_out_of_office_waiting");
    expect(waiting?.predicted.status).toBe("waiting");
    expect(waiting?.bucket).toBe("waiting");
    expect(waiting?.predicted.requires_action).toBe(false);
    expect(logicalLabelsForAnalysis(waiting!.predicted)).not.toContain("low_priority");
    expect(logicalLabelsForAnalysis(waiting!.predicted)).not.toContain("action_required");

    const share = rows.find((row) => row.id === "case_051_drive_document_share");
    expect(share?.predicted.status).toBe("informational");
    expect(share?.bucket).toBe("summary");
    expect(share?.predicted.requires_action).toBe(false);

    const statuses = new Set([
      ...rows.map((row) => row.predicted.status),
      securityFooter.status,
      mixedInvoice.status,
    ]);
    expect(statuses).toEqual(new Set(["action_required", "waiting", "informational", "ignore"]));

    const buckets = rows.map((row) => ({ id: row.id, bucket: row.bucket }));
    assertExclusiveMailBuckets(buckets);
    expect(new Set(buckets.map((row) => row.bucket)).size).toBeGreaterThanOrEqual(4);
  });
});
