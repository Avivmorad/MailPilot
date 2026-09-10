import { google, type gmail_v1 } from "googleapis";

import { createAdminClient } from "@/lib/supabase/admin";
import { MAILPILOT_LABELS, type MailPilotLogicalLabel } from "@/lib/gmail/constants";
import { createOAuth2Client } from "@/lib/gmail/oauth";
import { GMAIL_UNITS } from "@/lib/gmail/quota";
import { withGmailRetry } from "@/lib/gmail/retry";

/**
 * Ensure managed MailPilot labels exist in Gmail and persist the
 * logical_name -> gmail_label_id mapping. Idempotent.
 */
export async function ensureManagedLabels(
  connectionId: string,
  accessToken: string,
  refreshToken: string,
): Promise<void> {
  const client = createOAuth2Client();
  client.setCredentials({ access_token: accessToken, refresh_token: refreshToken });
  const gmail = google.gmail({ version: "v1", auth: client });

  const existing = await listAllLabels(gmail);
  const byName = new Map(
    existing
      .filter((label) => typeof label.name === "string" && typeof label.id === "string")
      .map((label) => [label.name as string, label.id as string]),
  );

  const db = createAdminClient();

  for (const spec of MAILPILOT_LABELS) {
    let gmailLabelId = byName.get(spec.gmailLabelName);
    if (!gmailLabelId) {
      const created = await withGmailRetry(
        () =>
          gmail.users.labels.create({
            userId: "me",
            requestBody: {
              name: spec.gmailLabelName,
              labelListVisibility: "labelShow",
              messageListVisibility: "show",
            },
          }),
        { units: GMAIL_UNITS.labelsCreate },
      );
      if (!created.data.id) {
        throw new Error(`Failed to create Gmail label ${spec.gmailLabelName}`);
      }
      gmailLabelId = created.data.id;
      byName.set(spec.gmailLabelName, gmailLabelId);
    }

    const { error } = await db.from("gmail_labels").upsert(
      {
        gmail_connection_id: connectionId,
        logical_name: spec.logicalName,
        gmail_label_id: gmailLabelId,
        gmail_label_name: spec.gmailLabelName,
      },
      { onConflict: "gmail_connection_id,logical_name" },
    );
    if (error) {
      throw new Error(`Failed to store label mapping for ${spec.logicalName}`);
    }
  }
}

async function listAllLabels(gmail: gmail_v1.Gmail): Promise<gmail_v1.Schema$Label[]> {
  const res = await withGmailRetry(() => gmail.users.labels.list({ userId: "me" }), {
    units: GMAIL_UNITS.labelsList,
  });
  return res.data.labels ?? [];
}

export async function loadLabelIdMap(
  connectionId: string,
): Promise<Map<MailPilotLogicalLabel, string>> {
  const db = createAdminClient();
  const { data, error } = await db
    .from("gmail_labels")
    .select("logical_name, gmail_label_id")
    .eq("gmail_connection_id", connectionId);
  if (error) {
    throw new Error("Failed to load MailPilot label mappings");
  }
  const map = new Map<MailPilotLogicalLabel, string>();
  for (const row of data ?? []) {
    const logical = row.logical_name as MailPilotLogicalLabel;
    if (MAILPILOT_LABELS.some((spec) => spec.logicalName === logical) && typeof row.gmail_label_id === "string") {
      map.set(logical, row.gmail_label_id);
    }
  }
  return map;
}

export async function modifyThreadLabels(
  gmail: gmail_v1.Gmail,
  threadId: string,
  addLabelIds: string[],
  removeLabelIds: string[],
): Promise<void> {
  if (addLabelIds.length === 0 && removeLabelIds.length === 0) {
    return;
  }
  await withGmailRetry(
    () =>
      gmail.users.threads.modify({
        userId: "me",
        id: threadId,
        requestBody: {
          addLabelIds,
          removeLabelIds,
        },
      }),
    { units: GMAIL_UNITS.threadsModify },
  );
}
