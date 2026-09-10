import { z } from "zod";

import type { ActionStatus } from "@/lib/actions/reconcile-action";

export const MAIL_TABS = [
  { id: "summary", label: "Summary" },
  { id: "open", label: "Open" },
  { id: "waiting", label: "Waiting" },
  { id: "completed", label: "Completed" },
  { id: "snoozed", label: "Snoozed" },
  { id: "ignored", label: "Ignored" },
] as const;

export const mailTabSchema = z.enum([
  "summary",
  "open",
  "waiting",
  "completed",
  "snoozed",
  "ignored",
]);

export type MailTab = z.infer<typeof mailTabSchema>;

const ACTION_MAIL_TABS: Record<Exclude<MailTab, "summary" | "ignored">, ActionStatus> = {
  open: "OPEN",
  waiting: "WAITING",
  completed: "COMPLETED",
  snoozed: "SNOOZED",
};

export function parseMailTab(value: string | null | undefined): MailTab {
  const parsed = mailTabSchema.safeParse(value);
  return parsed.success ? parsed.data : "summary";
}

export function isMailTab(value: string | null | undefined): value is MailTab {
  return mailTabSchema.safeParse(value).success;
}

export function actionStatusForMailTab(tab: MailTab): ActionStatus | null {
  if (tab === "summary" || tab === "ignored") {
    return null;
  }
  return ACTION_MAIL_TABS[tab];
}

const LEGACY_ACTION_TAB: Record<string, MailTab> = {
  OPEN: "open",
  WAITING: "waiting",
  COMPLETED: "completed",
  SNOOZED: "snoozed",
};

export function mailTabFromLegacyActionTab(value: string | null | undefined): MailTab {
  if (value && value in LEGACY_ACTION_TAB) {
    return LEGACY_ACTION_TAB[value]!;
  }
  return parseMailTab(value);
}
