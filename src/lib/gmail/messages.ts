import type { gmail_v1 } from "googleapis";

import { parseGmailMessage, type ParsedGmailMessage } from "@/lib/gmail/parser";
import { buildThreadContext, type ThreadContext } from "@/lib/gmail/thread-context";

export async function fetchAndParseMessage(
  gmail: gmail_v1.Gmail,
  messageId: string,
): Promise<ParsedGmailMessage> {
  const res = await gmail.users.messages.get({
    userId: "me",
    id: messageId,
    format: "full",
  });
  return parseGmailMessage(res.data);
}

export async function fetchAndParseThread(
  gmail: gmail_v1.Gmail,
  threadId: string,
): Promise<ParsedGmailMessage[]> {
  const res = await gmail.users.threads.get({
    userId: "me",
    id: threadId,
    format: "full",
  });
  const messages = res.data.messages ?? [];
  return messages.map((message) => parseGmailMessage(message));
}

export async function loadThreadContextFromGmail(
  gmail: gmail_v1.Gmail,
  threadId: string,
  userEmails: string[],
): Promise<ThreadContext> {
  const parsed = await fetchAndParseThread(gmail, threadId);
  return buildThreadContext(parsed, userEmails);
}
