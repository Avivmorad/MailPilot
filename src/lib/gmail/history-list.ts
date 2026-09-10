import type { gmail_v1 } from "googleapis";

import {
  isStaleHistoryError,
  refsFromHistoryRecords,
  type HistoryListResult,
} from "@/lib/gmail/history";
import { GMAIL_UNITS } from "@/lib/gmail/quota";
import { withGmailRetry } from "@/lib/gmail/retry";

export async function listHistoryChanges(
  gmail: gmail_v1.Gmail,
  startHistoryId: string,
): Promise<HistoryListResult> {
  const records: Array<{ messagesAdded?: gmail_v1.Schema$History["messagesAdded"] }> = [];
  let pageToken: string | undefined;
  let latestHistoryId: string | null = null;
  try {
    do {
      const res: { data: gmail_v1.Schema$ListHistoryResponse } = await withGmailRetry(
        () =>
          gmail.users.history.list({
            userId: "me",
            startHistoryId,
            historyTypes: ["messageAdded"],
            maxResults: 100,
            pageToken,
          }),
        { units: GMAIL_UNITS.historyList },
      );
      latestHistoryId = res.data.historyId ?? latestHistoryId;
      for (const item of res.data.history ?? []) {
        records.push(item);
      }
      pageToken = res.data.nextPageToken ?? undefined;
    } while (pageToken);
  } catch (error) {
    if (isStaleHistoryError(error)) {
      return { ok: false, stale: true };
    }
    throw error;
  }
  return { ok: true, refs: refsFromHistoryRecords(records), latestHistoryId };
}
