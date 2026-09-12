import { analyzeThread, type EmailTriageProvider } from "@/lib/ai/analyze-thread";
import { groundedIsoDates } from "@/lib/ai/deadlines";
import { formatEvalThreadText, loadEvalCases, type EvalCase } from "@/lib/ai/eval-fixtures";
import { isSecurityEventNotice } from "@/lib/ai/notices";
import { threadAnalysisSchema, type ThreadAnalysis } from "@/lib/ai/schemas";
import type { ThreadAnalysisInput } from "@/lib/ai/types";

export const EVAL_THRESHOLDS = {
  schemaValidity: 1,
  actionRecall: 0.9,
  deadlineHallucination: 0,
} as const;

export const EVAL_RISK_WEIGHTS = {
  securityFalseNegative: 10,
  actionFalseNegative: 5,
  waitingMiss: 3,
  ignoreFalsePositiveOnAction: 4,
  actionFalsePositive: 1,
  deadlineHallucination: 8,
} as const;

export interface ScorecardCaseResult {
  id: string;
  schemaValid: boolean;
  expectedAction: boolean;
  predictedAction: boolean;
  expectedWaiting: boolean;
  predictedWaiting: boolean;
  predictedIgnore: boolean;
  security: boolean;
  hebrewOrMixed: boolean;
  deadlineHallucinated: boolean;
  actionTypeMatch: boolean;
  riskLoss: number;
}

export interface EvalScorecard {
  caseCount: number;
  schemaValidity: number;
  actionRecall: number;
  actionPrecision: number;
  waitingAccuracy: number;
  ignoreFalsePositiveRate: number;
  securityFalseNegativeRate: number;
  actionTypeAccuracy: number;
  deadlineHallucinationRate: number;
  hebrewOrMixedActionRecall: number;
  riskWeightedLoss: number;
  cases: ScorecardCaseResult[];
}

export function evalCaseToInput(evalCase: EvalCase): ThreadAnalysisInput {
  const latest = evalCase.messages.at(-1);
  return {
    userEmails: evalCase.userEmails,
    threadText: formatEvalThreadText(evalCase.messages),
    latestFrom: latest?.from ?? null,
    latestSubject: latest?.subject ?? null,
    latestDirection: latest?.direction ?? null,
  };
}

/**
 * Conservative mock model: assume a reply is needed and invent a deadline.
 * Post-processing and notices must recover the curated labels.
 */
export function confusedTriageProvider(): EmailTriageProvider {
  return {
    async analyzeThread(input) {
      return {
        summary: input.latestSubject?.trim() || "Email thread",
        importance: "high",
        importance_reason: "Confused baseline assumes every thread needs a reply",
        status: "action_required",
        requires_action: true,
        requires_reply: true,
        action_type: "reply",
        action_summary: "Reply to this thread",
        action_reason: "Confused baseline",
        waiting_for: null,
        waiting_since: null,
        urgency: "soon",
        deadline: "1999-01-01",
        deadline_text: "ASAP",
        category: "other",
        sender_name: null,
        organization: null,
        confidence: 0.45,
        short_display_title: input.latestSubject?.trim() || "Email",
      };
    },
  };
}

function ratio(numerator: number, denominator: number, emptyValue = 1): number {
  if (denominator === 0) {
    return emptyValue;
  }
  return numerator / denominator;
}

function containsHebrew(text: string): boolean {
  return /[\u0590-\u05FF]/.test(text);
}

export function scorePrediction(
  evalCase: EvalCase,
  predicted: ThreadAnalysis | null,
): ScorecardCaseResult {
  const expected = evalCase.expected;
  const schemaValid = predicted ? threadAnalysisSchema.safeParse(predicted).success : false;
  const predictedAction = predicted?.requires_action === true;
  const predictedWaiting = predicted?.status === "waiting";
  const predictedIgnore = predicted?.status === "ignore";
  const security =
    expected.requires_action &&
    isSecurityEventNotice([
      evalCase.messages.at(-1)?.subject,
      formatEvalThreadText(evalCase.messages),
    ]);
  const hebrewOrMixed = containsHebrew(formatEvalThreadText(evalCase.messages));
  const grounded = groundedIsoDates(formatEvalThreadText(evalCase.messages));
  const deadlineHallucinated = Boolean(predicted?.deadline && !grounded.has(predicted.deadline));
  const actionTypeMatch = predicted?.action_type === expected.action_type;

  let riskLoss = 0;
  if (expected.requires_action && !predictedAction) {
    riskLoss += security
      ? EVAL_RISK_WEIGHTS.securityFalseNegative
      : EVAL_RISK_WEIGHTS.actionFalseNegative;
  } else if (!expected.requires_action && predictedAction) {
    riskLoss += EVAL_RISK_WEIGHTS.actionFalsePositive;
  }
  if (expected.status === "waiting" && !predictedWaiting) {
    riskLoss += EVAL_RISK_WEIGHTS.waitingMiss;
  }
  if (predictedIgnore && expected.requires_action) {
    riskLoss += EVAL_RISK_WEIGHTS.ignoreFalsePositiveOnAction;
  }
  if (deadlineHallucinated) {
    riskLoss += EVAL_RISK_WEIGHTS.deadlineHallucination;
  }

  return {
    id: evalCase.id,
    schemaValid,
    expectedAction: expected.requires_action,
    predictedAction,
    expectedWaiting: expected.status === "waiting",
    predictedWaiting,
    predictedIgnore,
    security,
    hebrewOrMixed,
    deadlineHallucinated,
    actionTypeMatch,
    riskLoss,
  };
}

export function summarizeScorecard(cases: ScorecardCaseResult[]): EvalScorecard {
  const actionExpected = cases.filter((row) => row.expectedAction);
  const actionPredicted = cases.filter((row) => row.predictedAction);
  const actionTruePositive = cases.filter((row) => row.expectedAction && row.predictedAction);
  const waitingCases = cases.filter((row) => row.expectedWaiting);
  const ignoreFalsePositives = cases.filter((row) => row.predictedIgnore && row.expectedAction);
  const securityCases = cases.filter((row) => row.security);
  const securityFalseNegatives = securityCases.filter((row) => !row.predictedAction);
  const hebrewAction = cases.filter((row) => row.hebrewOrMixed && row.expectedAction);

  return {
    caseCount: cases.length,
    schemaValidity: ratio(cases.filter((row) => row.schemaValid).length, cases.length),
    actionRecall: ratio(actionTruePositive.length, actionExpected.length),
    actionPrecision: ratio(actionTruePositive.length, actionPredicted.length),
    waitingAccuracy: ratio(
      waitingCases.filter((row) => row.predictedWaiting).length,
      waitingCases.length,
    ),
    ignoreFalsePositiveRate: ratio(ignoreFalsePositives.length, cases.length),
    securityFalseNegativeRate: ratio(securityFalseNegatives.length, securityCases.length, 0),
    actionTypeAccuracy: ratio(cases.filter((row) => row.actionTypeMatch).length, cases.length),
    deadlineHallucinationRate: ratio(
      cases.filter((row) => row.deadlineHallucinated).length,
      cases.length,
    ),
    hebrewOrMixedActionRecall: ratio(
      hebrewAction.filter((row) => row.predictedAction).length,
      hebrewAction.length,
    ),
    riskWeightedLoss: cases.reduce((sum, row) => sum + row.riskLoss, 0),
    cases,
  };
}

export function formatScorecardReport(scorecard: EvalScorecard): string {
  return [
    `cases=${scorecard.caseCount}`,
    `schemaValidity=${scorecard.schemaValidity.toFixed(3)}`,
    `actionRecall=${scorecard.actionRecall.toFixed(3)}`,
    `actionPrecision=${scorecard.actionPrecision.toFixed(3)}`,
    `waitingAccuracy=${scorecard.waitingAccuracy.toFixed(3)}`,
    `ignoreFalsePositiveRate=${scorecard.ignoreFalsePositiveRate.toFixed(3)}`,
    `securityFalseNegativeRate=${scorecard.securityFalseNegativeRate.toFixed(3)}`,
    `actionTypeAccuracy=${scorecard.actionTypeAccuracy.toFixed(3)}`,
    `deadlineHallucinationRate=${scorecard.deadlineHallucinationRate.toFixed(3)}`,
    `hebrewOrMixedActionRecall=${scorecard.hebrewOrMixedActionRecall.toFixed(3)}`,
    `riskWeightedLoss=${scorecard.riskWeightedLoss}`,
  ].join("\n");
}

export async function runDeterministicScorecard(
  evalCases: EvalCase[] = loadEvalCases(),
  provider: EmailTriageProvider = confusedTriageProvider(),
): Promise<EvalScorecard> {
  const rows: ScorecardCaseResult[] = [];
  for (const evalCase of evalCases) {
    const input = evalCaseToInput(evalCase);
    try {
      const predicted = await analyzeThread(input, provider);
      rows.push(scorePrediction(evalCase, predicted));
    } catch {
      rows.push(scorePrediction(evalCase, null));
    }
  }
  return summarizeScorecard(rows);
}
