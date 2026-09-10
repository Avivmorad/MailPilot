import { google, type gmail_v1 } from "googleapis";

import { createAdminClient } from "@/lib/supabase/admin";
import { MAILPILOT_LABELS } from "@/lib/gmail/constants";
import { createOAuth2Client } from "@/lib/gmail/oauth";

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
      const created = await gmail.users.labels.create({
        userId: "me",
        requestBody: {
          name: spec.gmailLabelName,
          labelListVisibility: "labelShow",
          messageListVisibility: "show",
        },
      });
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
  const res = await gmail.users.labels.list({ userId: "me" });
  return res.data.labels ?? [];
}
