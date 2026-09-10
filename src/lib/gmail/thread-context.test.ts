import { describe, expect, it } from "vitest";

import type { ParsedGmailMessage } from "@/lib/gmail/parser";
import { buildThreadContext } from "@/lib/gmail/thread-context";

function message(partial: Partial<ParsedGmailMessage> & Pick<ParsedGmailMessage, "gmailMessageId">): ParsedGmailMessage {
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

describe("buildThreadContext", () => {
  it("keeps the latest messages and records direction", () => {
    const context = buildThreadContext(
      [
        message({
          gmailMessageId: "1",
          internalDate: "1",
          from: "me@example.com",
          to: "ada@example.com",
          subject: "Proposal",
          plainText: "Can you approve by Friday?",
        }),
        message({
          gmailMessageId: "2",
          internalDate: "2",
          from: "ada@example.com",
          to: "me@example.com",
          subject: "Re: Proposal",
          plainText: "I'll review it tomorrow.",
        }),
      ],
      ["me@example.com"],
      {
        MAX_THREAD_MESSAGES: 6,
        MAX_MESSAGE_CHARS: 12000,
        MAX_THREAD_CHARS: 35000,
        AI_MAX_CONCURRENCY: 5,
        GMAIL_QUOTA_UNITS_PER_MINUTE: 12000,
      },
    );

    expect(context.messages[0]?.direction).toBe("OUTBOUND");
    expect(context.messages[1]?.direction).toBe("INBOUND");
    expect(context.promptText).toContain("Direction: OUTBOUND");
    expect(context.promptText).toContain("I'll review it tomorrow.");
  });

  it("caps the number of messages", () => {
    const many = Array.from({ length: 8 }, (_, index) =>
      message({
        gmailMessageId: String(index),
        internalDate: String(index),
        from: "ada@example.com",
        to: "me@example.com",
        plainText: `msg ${index}`,
      }),
    );
    const context = buildThreadContext(many, ["me@example.com"], {
      MAX_THREAD_MESSAGES: 3,
      MAX_MESSAGE_CHARS: 12000,
      MAX_THREAD_CHARS: 35000,
      AI_MAX_CONCURRENCY: 5,
      GMAIL_QUOTA_UNITS_PER_MINUTE: 12000,
    });
    expect(context.messages).toHaveLength(3);
    expect(context.messages[0]?.gmailMessageId).toBe("5");
  });
});
