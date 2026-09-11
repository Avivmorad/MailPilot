import { readFileSync } from "node:fs";
import path from "node:path";

import { z } from "zod";

import { normalizeCategory } from "@/lib/ai/categories";
import { assertThreadAnalysisInvariants, postProcessThreadAnalysis } from "@/lib/ai/post-process";
import {
  actionTypeSchema,
  importanceSchema,
  threadAnalysisSchema,
  threadStatusSchema,
  type ThreadAnalysis,
  type ThreadStatus,
} from "@/lib/ai/schemas";

const catalogRowSchema = z.object({
  id: z.string().min(1),
  subject: z.string(),
  sender_type: z.string().min(1),
  email_body: z.string(),
  expected_importance: importanceSchema,
  expected_action: actionTypeSchema,
  expected_summary: z.string().min(1),
});

const evalMessageSchema = z.object({
  from: z.string(),
  to: z.string(),
  subject: z.string(),
  body: z.string(),
  direction: z.enum(["INBOUND", "OUTBOUND", "SELF", "UNKNOWN"]),
});

const evalExpectedSchema = z.object({
  importance: importanceSchema,
  action_type: actionTypeSchema,
  requires_action: z.boolean(),
  requires_reply: z.boolean(),
  status: threadStatusSchema,
  deadline: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable(),
  summary: z.string().min(1),
});

export const evalCaseSchema = z.object({
  id: z.string().min(1),
  userEmails: z.array(z.string().min(1)).min(1),
  messages: z.array(evalMessageSchema).min(1),
  expected: evalExpectedSchema,
});

export type EvalCase = z.infer<typeof evalCaseSchema>;

function readJsonFile(relativePath: string): unknown {
  const absolute = path.join(process.cwd(), relativePath);
  return JSON.parse(readFileSync(absolute, "utf8")) as unknown;
}

function statusFromCatalog(row: z.infer<typeof catalogRowSchema>): ThreadStatus {
  if (row.expected_action !== "none") {
    return "action_required";
  }
  if (/waiting|already_replied/i.test(row.id)) {
    return "waiting";
  }
  if (/resolved/i.test(row.id)) {
    return "resolved";
  }
  if (/phish/i.test(row.id) || ["newsletter", "promotion", "social"].includes(row.sender_type)) {
    return "ignore";
  }
  return "informational";
}

export function catalogRowToEvalCase(row: z.infer<typeof catalogRowSchema>): EvalCase {
  const requiresAction = row.expected_action !== "none";
  const requiresReply = row.expected_action === "reply";
  const status = statusFromCatalog(row);
  const direction = status === "waiting" ? "OUTBOUND" : "INBOUND";
  return evalCaseSchema.parse({
    id: row.id,
    userEmails: ["me@example.com"],
    messages: [
      {
        from: direction === "OUTBOUND" ? "me@example.com" : `sender@${row.sender_type}.example`,
        to: direction === "OUTBOUND" ? `sender@${row.sender_type}.example` : "me@example.com",
        subject: row.subject,
        body: row.email_body,
        direction,
      },
    ],
    expected: {
      importance: row.expected_importance,
      action_type: row.expected_action,
      requires_action: requiresAction,
      requires_reply: requiresReply,
      status,
      deadline: null,
      summary: row.expected_summary,
    },
  });
}

export function loadCatalogEvalCases(): EvalCase[] {
  const raw = z.array(catalogRowSchema).parse(readJsonFile("tests/fixtures/email-triage.json"));
  return raw.map(catalogRowToEvalCase);
}

export function loadExtraEvalCases(): EvalCase[] {
  const raw = z.array(evalCaseSchema).parse(readJsonFile("tests/evals/email-triage.json"));
  return raw;
}

export function loadEvalCases(): EvalCase[] {
  const byId = new Map<string, EvalCase>();
  for (const evalCase of [...loadCatalogEvalCases(), ...loadExtraEvalCases()]) {
    byId.set(evalCase.id, evalCase);
  }
  return [...byId.values()];
}

export function formatEvalThreadText(messages: EvalCase["messages"]): string {
  return messages
    .map((message, index) =>
      [
        `[MESSAGE ${index + 1}]`,
        `Direction: ${message.direction}`,
        `From: ${message.from}`,
        `To: ${message.to}`,
        `Subject: ${message.subject}`,
        "",
        message.body,
      ].join("\n"),
    )
    .join("\n\n");
}

export function goldAnalysisForEvalCase(evalCase: EvalCase): ThreadAnalysis {
  const latest = evalCase.messages.at(-1);
  const senderType = latest?.from.includes("@")
    ? latest.from.split("@")[1]?.split(".")[0]
    : undefined;
  const category = normalizeCategory(senderType);

  const analysis: ThreadAnalysis = {
    summary: evalCase.expected.summary,
    importance: evalCase.expected.importance,
    importance_reason: "Gold fixture",
    status: evalCase.expected.status,
    requires_action: evalCase.expected.requires_action,
    requires_reply: evalCase.expected.requires_reply,
    action_type: evalCase.expected.action_type,
    action_summary: evalCase.expected.requires_action ? evalCase.expected.summary : null,
    action_reason: evalCase.expected.requires_action ? evalCase.expected.summary : null,
    waiting_for: evalCase.expected.status === "waiting" ? "the other party" : null,
    waiting_since: null,
    urgency:
      evalCase.expected.importance === "high"
        ? "soon"
        : evalCase.expected.status === "ignore"
          ? "none"
          : "normal",
    deadline: evalCase.expected.deadline,
    deadline_text: null,
    category,
    sender_name: null,
    organization: null,
    confidence: 0.9,
    short_display_title: evalCase.expected.summary.slice(0, 80),
  };

  const processed = postProcessThreadAnalysis(analysis);
  assertThreadAnalysisInvariants(processed);
  return threadAnalysisSchema.parse(processed);
}

export function threadContainsIsoDate(evalCase: EvalCase): boolean {
  const haystack = evalCase.messages
    .map((message) => `${message.subject}\n${message.body}`)
    .join("\n");
  return /\b\d{4}-\d{2}-\d{2}\b/.test(haystack);
}
