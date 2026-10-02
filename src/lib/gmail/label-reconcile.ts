import type { gmail_v1 } from "googleapis";

import { MAILPILOT_LABELS, type MailPilotLogicalLabel } from "@/lib/gmail/constants";
import { ensureManagedLabelsWithGmail, loadLabelIdMap } from "@/lib/gmail/labels";

/**
 * Load label IDs; if any MailPilot mapping is missing, create/reconcile first.
 * Used by scans so deferred post-connect setup cannot leave labeling broken.
 */
export async function loadOrEnsureLabelIdMap(
  connectionId: string,
  gmail: gmail_v1.Gmail,
): Promise<Map<MailPilotLogicalLabel, string>> {
  const existing = await loadLabelIdMap(connectionId);
  if (existing.size >= MAILPILOT_LABELS.length) {
    return existing;
  }
  await ensureManagedLabelsWithGmail(connectionId, gmail);
  return loadLabelIdMap(connectionId);
}
