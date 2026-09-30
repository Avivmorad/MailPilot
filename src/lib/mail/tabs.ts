import { z } from "zod";

import type { ActionStatus } from "@/lib/actions/reconcile-action";

export const MAIL_TABS = [
  { id: "summary", label: "Summary" },
  { id: "open", label: "Actions" },
  { id: "waiting", label: "Pending" },
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

export function mailTabEmptyCopy(tab: MailTab): { title: string; description: string } {
  switch (tab) {
    case "open":
      return {
        title: "No actions right now.",
        description:
          "When a thread still needs a real next step, it will show up here — grouped by category.",
      };
    case "waiting":
      return {
        title: "Nothing is pending a reply.",
        description: "After you act, threads move here until the other side replies.",
      };
    case "completed":
      return {
        title: "No completed tasks yet.",
        description: "Mark an action done and it will land here.",
      };
    case "snoozed":
      return {
        title: "Nothing snoozed.",
        description: "Postpone an action and it returns to Actions when the snooze ends.",
      };
    case "ignored":
      return {
        title: "Nothing ignored",
        description: "OTP notices and other ignore-classified mail will appear here after a scan.",
      };
    case "summary":
      return {
        title: "No leftover For You mail yet",
        description:
          "Run a scan to see useful updates. Receipts, OTPs, and marketing are in Ignored.",
      };
  }
}
