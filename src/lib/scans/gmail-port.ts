import type { gmail_v1 } from "googleapis";

import { loadLabelIdMap, modifyThreadLabels } from "@/lib/gmail/labels";
import { listHistoryChanges } from "@/lib/gmail/history-list";
import { fetchAndParseThread, fetchProfileHistoryId, listMessageRefs } from "@/lib/gmail/messages";
import type { ScanGmailPort } from "@/lib/scans/types";

export function createGmailScanPort(gmail: gmail_v1.Gmail, connectionId: string): ScanGmailPort {
  return {
    listMessageRefs: (query) => listMessageRefs(gmail, query),
    listHistoryChanges: (startHistoryId) => listHistoryChanges(gmail, startHistoryId),
    fetchThread: (threadId) => fetchAndParseThread(gmail, threadId),
    getProfileHistoryId: () => fetchProfileHistoryId(gmail),
    loadLabelMap: () => loadLabelIdMap(connectionId),
    modifyThreadLabels: (threadId, addLabelIds, removeLabelIds) =>
      modifyThreadLabels(gmail, threadId, addLabelIds, removeLabelIds),
  };
}
