import type { gmail_v1 } from "googleapis";

import { parseGmailMessage, type ParsedGmailMessage } from "@/lib/gmail/parser";
import { GMAIL_UNITS } from "@/lib/gmail/quota";
import { withGmailRetry } from "@/lib/gmail/retry";
import type { GmailRequestBudget } from "@/lib/gmail/request-budget";
import { buildThreadContext, type ThreadContext } from "@/lib/gmail/thread-context";

export async function listMessageRefs(
  gmail: gmail_v1.Gmail,
  query: string,
  budget: GmailRequestBudget = {},
): Promise<Array<{ id: string; threadId: string }>> {
  const refs: Array<{ id: string; threadId: string }> = [];
  let pageToken: string | undefined;
  do {
    const res: { data: gmail_v1.Schema$ListMessagesResponse } = await withGmailRetry(
      (options) =>
        gmail.users.messages.list(
          {
            userId: "me",
            q: query,
            maxResults: 100,
            pageToken,
          },
          options,
        ),
      { ...budget, units: GMAIL_UNITS.messagesList },
    );
    for (const message of res.data.messages ?? []) {
      if (message.id && message.threadId) {
        refs.push({ id: message.id, threadId: message.threadId });
      }
    }
    pageToken = res.data.nextPageToken ?? undefined;
  } while (pageToken);
  return refs;
}

export async function fetchProfileHistoryId(
  gmail: gmail_v1.Gmail,
  budget: GmailRequestBudget = {},
): Promise<string | null> {
  const res = await withGmailRetry((options) => gmail.users.getProfile({ userId: "me" }, options), {
    ...budget,
    units: GMAIL_UNITS.getProfile,
  });
  return res.data.historyId ?? null;
}

export async function fetchAndParseMessage(
  gmail: gmail_v1.Gmail,
  messageId: string,
  budget: GmailRequestBudget = {},
): Promise<ParsedGmailMessage> {
  const res = await withGmailRetry(
    (options) =>
      gmail.users.messages.get(
        {
          userId: "me",
          id: messageId,
          format: "full",
        },
        options,
      ),
    { ...budget, units: GMAIL_UNITS.messagesGet },
  );
  return parseGmailMessage(res.data);
}

export async function fetchAndParseThread(
  gmail: gmail_v1.Gmail,
  threadId: string,
  budget: GmailRequestBudget = {},
): Promise<ParsedGmailMessage[]> {
  const res = await withGmailRetry(
    (options) =>
      gmail.users.threads.get(
        {
          userId: "me",
          id: threadId,
          format: "full",
        },
        options,
      ),
    { ...budget, units: GMAIL_UNITS.threadsGet },
  );
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
