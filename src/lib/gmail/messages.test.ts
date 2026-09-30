import { describe, expect, it, vi } from "vitest";

import type { gmail_v1 } from "googleapis";

import {
  fetchAndParseThread,
  listMessageRefs,
  loadThreadContextFromGmail,
} from "@/lib/gmail/messages";

function b64(value: string): string {
  return Buffer.from(value, "utf8").toString("base64url");
}

describe("listMessageRefs", () => {
  it("keeps refs across empty and duplicate pages", async () => {
    const list = vi.fn(async ({ pageToken }: { pageToken?: string }) => {
      if (!pageToken) {
        return { data: { messages: [{ id: "m1", threadId: "t1" }], nextPageToken: "p2" } };
      }
      if (pageToken === "p2") {
        return { data: { messages: [], nextPageToken: "p3" } };
      }
      return {
        data: {
          messages: [
            { id: "m1", threadId: "t1" },
            { id: "m2", threadId: "t2" },
          ],
        },
      };
    });
    const gmail = { users: { messages: { list } } } as unknown as gmail_v1.Gmail;

    await expect(listMessageRefs(gmail, "in:inbox")).resolves.toEqual([
      { id: "m1", threadId: "t1" },
      { id: "m1", threadId: "t1" },
      { id: "m2", threadId: "t2" },
    ]);
    expect(list.mock.calls.map(([request]) => request.pageToken)).toEqual([undefined, "p2", "p3"]);
  });

  it("rejects a repeated page token before requesting it again", async () => {
    const list = vi.fn(async () => {
      if (list.mock.calls.length > 2) throw new Error("unexpected third request");
      return { data: { messages: [], nextPageToken: "p2" } };
    });
    const gmail = { users: { messages: { list } } } as unknown as gmail_v1.Gmail;

    await expect(listMessageRefs(gmail, "in:inbox")).rejects.toThrow(
      "Gmail message pagination repeated a page token",
    );
    expect(list).toHaveBeenCalledTimes(2);
  });
});

describe("fetchAndParseThread", () => {
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
