import { countActionRowsByStatus } from "@/lib/actions/queries";
import { getInboxCountsForUser } from "@/lib/scans/manual";

export interface MailFigures {
  processed: number;
  actions: number;
  pending: number;
  forYou: number;
  ignored: number;
  important: number;
  closed: number;
  snoozed: number;
}

export async function getMailFigures(userId: string): Promise<MailFigures> {
  const [counts, workflow] = await Promise.all([
    getInboxCountsForUser(userId),
    countActionRowsByStatus(userId, ["COMPLETED", "SNOOZED"]),
  ]);
  return {
    processed: counts.processed,
    actions: counts.needAction,
    pending: counts.waiting,
    forYou: counts.fyi,
    ignored: counts.ignored,
    important: counts.important,
    closed: workflow.COMPLETED,
    snoozed: workflow.SNOOZED,
  };
}
