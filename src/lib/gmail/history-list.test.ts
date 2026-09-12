import { describe, expect, it } from "vitest";

import type { gmail_v1 } from "googleapis";

import { listHistoryChanges } from "@/lib/gmail/history-list";

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
});
