import type { MailTab } from "@/lib/mail/tabs";
import type { FeedbackKind } from "@/lib/threads/apply-feedback";

const EMAIL_RE = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;

export const PLACEMENT_RULE: Record<MailTab, string> = {
  open: "This is in Open because it still needs a next step from you.",
  waiting: "This is in Pending because you already acted.",
  completed: "This is in Completed because you marked the task done.",
  snoozed: "This is in Snoozed until the reminder date.",
  summary: "This is in Summary because it is leftover FYI, not an open task.",
  ignored: "This is in Ignored because it is noise or a notice, not a task.",
};

export const PLACEMENT_CORRECTIONS: Record<MailTab, FeedbackKind[]> = {
  open: ["no_action", "waiting"],
  waiting: ["action", "not_waiting"],
  completed: ["action"],
  snoozed: ["action"],
  summary: ["action"],
  ignored: ["action"],
};

export const PLACEMENT_CORRECTION_LABELS: Record<FeedbackKind, string> = {
  wrong: "Wrong",
  important: "Important",
  not_important: "Not important",
  action: "Needs action",
  no_action: "No action",
  waiting: "Pending",
  not_waiting: "Not pending",
};

export function sanitizePlacementEvidence(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }
  const cleaned = value.replace(EMAIL_RE, "[email]").replace(/\s+/g, " ").trim();
  if (!cleaned) {
    return null;
  }
  return cleaned.length > 160 ? `${cleaned.slice(0, 157).trimEnd()}…` : cleaned;
}

/** Rule-level placement copy. Optional AI evidence is appended only when it adds a distinct sentence. */
export function threadPlacementReason(input: { tab: MailTab; evidence?: string | null }): string {
  const rule = PLACEMENT_RULE[input.tab];
  const evidence = sanitizePlacementEvidence(input.evidence);
  if (!evidence || evidence === rule || rule.includes(evidence)) {
    return rule;
  }
  return `${rule} ${evidence}`;
}
