import { describe, expect, it } from "vitest";

import type { gmail_v1 } from "googleapis";

import { fetchAndParseThread, loadThreadContextFromGmail } from "@/lib/gmail/messages";
import { GmailMimeLimitError, MIME_PARSE_LIMITS } from "@/lib/gmail/parser";

function b64(value: string): string {
  return Buffer.from(value, "utf8").toString("base64url");
}

describe("fetchAndParseThread", () => {
  it("rejects excessive thread messages instead of returning a partial or empty success", async () => {
    const gmail = {
      users: {
        threads: {
          get: async () => ({
            data: {
              messages: Array.from({ length: MIME_PARSE_LIMITS.threadMessages + 1 }, () => ({})),
            },
          }),
        },
      },
    } as unknown as gmail_v1.Gmail;
    await expect(fetchAndParseThread(gmail, "synthetic-thread")).rejects.toThrow(
      GmailMimeLimitError,
    );
  });

  it("parses every message returned by threads.get", async () => {
    const gmail = {
      users: {
        threads: {
          get: async () => ({
            data: {
              messages: [
                {
                  id: "m1",
                  threadId: "t1",
                  internalDate: "1",
                  payload: {
                    mimeType: "text/plain",
                    headers: [
                      { name: "From", value: "me@example.com" },
                      { name: "To", value: "ada@example.com" },
                      { name: "Subject", value: "Hello" },
                    ],
                    body: { data: b64("Can you approve by Friday?") },
                  },
                },
                {
                  id: "m2",
                  threadId: "t1",
                  internalDate: "2",
                  payload: {
                    mimeType: "text/html",
                    headers: [
                      { name: "From", value: "ada@example.com" },
                      { name: "To", value: "me@example.com" },
                      { name: "Subject", value: "Re: Hello" },
                    ],
                    body: { data: b64("<p>I'll review it tomorrow.</p>") },
                  },
                },
              ],
            },
          }),
        },
      },
    } as unknown as gmail_v1.Gmail;

    const parsed = await fetchAndParseThread(gmail, "t1");
    expect(parsed).toHaveLength(2);
    expect(parsed[0]?.plainText).toBe("Can you approve by Friday?");
    expect(parsed[1]?.plainText).toBe("I'll review it tomorrow.");

    const context = await loadThreadContextFromGmail(gmail, "t1", ["me@example.com"]);
    expect(context.messages[0]?.direction).toBe("OUTBOUND");
    expect(context.messages[1]?.direction).toBe("INBOUND");
    expect(context.promptText).not.toMatch(/<p>/);
  });
});
