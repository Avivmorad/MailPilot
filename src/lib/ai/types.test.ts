import { describe, expect, it } from "vitest";

import { threadAnalysisInputFromContext } from "@/lib/ai/types";
import type { ParsedGmailMessage } from "@/lib/gmail/parser";
import { buildThreadContext } from "@/lib/gmail/thread-context";

function message(
  partial: Partial<ParsedGmailMessage> & Pick<ParsedGmailMessage, "gmailMessageId">,
): ParsedGmailMessage {
  return {
    gmailThreadId: "t1",
    historyId: null,
    internalDate: "0",
    from: null,
    to: null,
    cc: null,
    bcc: null,
    subject: null,
    messageIdHeader: null,
    inReplyTo: null,
    references: null,
    labelIds: [],
    snippet: null,
    plainText: "",
    hasAttachments: false,
    attachments: [],
    ...partial,
  };
}

describe("threadAnalysisInputFromContext", () => {
  it("uses the latest message metadata", () => {
    const context = buildThreadContext(
      [
        message({
          gmailMessageId: "1",
          internalDate: "1",
          from: "ada@example.com",
          to: "me@example.com",
          subject: "Hello",
          plainText: "Please reply",
        }),
      ],
      ["me@example.com"],
    );

    const input = threadAnalysisInputFromContext(context, ["me@example.com"]);
    expect(input.latestFrom).toBe("ada@example.com");
    expect(input.latestSubject).toBe("Hello");
    expect(input.latestDirection).toBe("INBOUND");
    expect(input.threadText).toContain("Please reply");
  });
});
