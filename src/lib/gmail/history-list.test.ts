import { describe, expect, it, vi } from "vitest";

import type { gmail_v1 } from "googleapis";

import { listHistoryChanges } from "@/lib/gmail/history-list";
import { GmailDeadlineError } from "@/lib/gmail/request-budget";

describe("listHistoryChanges", () => {
  it("pages through messageAdded history", async () => {
    let page = 0;
    const gmail = {
      users: {
        history: {
          list: async () => {
            page += 1;
            if (page === 1) {
              return {
                data: {
                  historyId: "200",
                  nextPageToken: "p2",
                  history: [
                    {
                      messagesAdded: [
                        { message: { id: "m1", threadId: "t1", labelIds: ["INBOX"] } },
                      ],
                    },
                  ],
                },
              };
            }
            return {
              data: {
                historyId: "201",
                history: [
                  {
                    messagesAdded: [{ message: { id: "m2", threadId: "t2", labelIds: ["INBOX"] } }],
                  },
                ],
              },
            };
          },
        },
      },
    } as unknown as gmail_v1.Gmail;

    const result = await listHistoryChanges(gmail, "100");
    expect(result).toEqual({
      ok: true,
      latestHistoryId: "201",
      refs: [
        { id: "m1", threadId: "t1" },
        { id: "m2", threadId: "t2" },
      ],
    });
  });

  it("returns stale when Gmail 404s the historyId", async () => {
    const gmail = {
      users: {
        history: {
          list: async () => {
            throw { response: { status: 404 }, message: "Requested entity was not found." };
          },
        },
      },
    } as unknown as gmail_v1.Gmail;

    await expect(listHistoryChanges(gmail, "old")).resolves.toEqual({ ok: false, stale: true });
  });

  it("deduplicates events across an empty middle page", async () => {
    const list = vi.fn(async ({ pageToken }: { pageToken?: string }) => {
      if (!pageToken) {
        return {
          data: {
            historyId: "200",
            nextPageToken: "p2",
            history: [{ messagesAdded: [{ message: { id: "m1", threadId: "t1" } }] }],
          },
        };
      }
      if (pageToken === "p2") return { data: { nextPageToken: "p3", history: [] } };
      return {
        data: {
          historyId: "203",
          history: [
            {
              messagesAdded: [
                { message: { id: "m1", threadId: "t1" } },
                { message: { id: "m2", threadId: "t1" } },
              ],
            },
          ],
        },
      };
    });
    const gmail = { users: { history: { list } } } as unknown as gmail_v1.Gmail;

    await expect(listHistoryChanges(gmail, "100")).resolves.toEqual({
      ok: true,
      refs: [
        { id: "m1", threadId: "t1" },
        { id: "m2", threadId: "t1" },
      ],
      latestHistoryId: "203",
    });
    expect(list.mock.calls.map(([request]) => request.pageToken)).toEqual([undefined, "p2", "p3"]);
  });

  it("rejects a repeated page token without returning partial history", async () => {
    const list = vi.fn(async () => {
      if (list.mock.calls.length > 2) throw new Error("unexpected third request");
      return { data: { historyId: "200", nextPageToken: "p2", history: [] } };
    });
    const gmail = { users: { history: { list } } } as unknown as gmail_v1.Gmail;

    await expect(listHistoryChanges(gmail, "100")).rejects.toThrow(
      "Gmail history pagination repeated a page token",
    );
    expect(list).toHaveBeenCalledTimes(2);
  });

  it("does not return the first page when a later page is rate limited past the deadline", async () => {
    const list = vi.fn(async ({ pageToken }: { pageToken?: string }) => {
      if (!pageToken) {
        return {
          data: {
            historyId: "200",
            nextPageToken: "p2",
            history: [{ messagesAdded: [{ message: { id: "m1", threadId: "t1" } }] }],
          },
        };
      }
      throw { status: 429, message: "rate limited" };
    });
    const gmail = { users: { history: { list } } } as unknown as gmail_v1.Gmail;

    await expect(
      listHistoryChanges(gmail, "100", { deadlineAt: Date.now() + 1_000 }),
    ).rejects.toBeInstanceOf(GmailDeadlineError);
    expect(list.mock.calls.map(([request]) => request.pageToken)).toEqual([undefined, "p2"]);
  });
});
