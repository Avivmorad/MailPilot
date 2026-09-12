import type { gmail_v1 } from "googleapis";

import { normalizeEmail } from "@/lib/gmail/addresses";
import { GMAIL_UNITS } from "@/lib/gmail/quota";
import { withGmailRetry } from "@/lib/gmail/retry";

const MAX_USER_EMAILS = 25;

export function mergeUserEmails(...groups: Array<readonly string[] | undefined>): string[] {
  const seen = new Set<string>();
  const merged: string[] = [];
  for (const group of groups) {
    for (const raw of group ?? []) {
      const email = normalizeEmail(raw);
      if (!email.includes("@") || seen.has(email)) {
        continue;
      }
      seen.add(email);
      merged.push(email);
      if (merged.length >= MAX_USER_EMAILS) {
        return merged;
      }
    }
  }
  return merged;
}

export function sendAsEmailsFromList(
  response: gmail_v1.Schema$ListSendAsResponse | undefined,
): string[] {
  const emails: string[] = [];
  for (const row of response?.sendAs ?? []) {
    if (typeof row.sendAsEmail === "string") {
      emails.push(row.sendAsEmail);
    }
  }
  return emails;
}

export async function listSendAsEmails(gmail: gmail_v1.Gmail): Promise<string[]> {
  const res = await withGmailRetry(() => gmail.users.settings.sendAs.list({ userId: "me" }), {
    units: GMAIL_UNITS.sendAsList,
  });
  return sendAsEmailsFromList(res.data);
}

export async function safeListSendAsEmails(
  list: (() => Promise<string[]>) | undefined,
): Promise<string[]> {
  if (!list) {
    return [];
  }
  try {
    return await list();
  } catch {
    return [];
  }
}
