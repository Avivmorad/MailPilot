import { createHash } from "node:crypto";

import type { ParsedGmailMessage } from "@/lib/gmail/parser";

export function messageContentHash(message: ParsedGmailMessage): string {
  const payload = [
    message.gmailMessageId,
    message.subject ?? "",
    message.from ?? "",
    message.to ?? "",
    message.plainText,
  ].join("\n");
  return createHash("sha256").update(payload).digest("hex");
}
