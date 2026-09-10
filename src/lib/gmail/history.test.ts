import { describe, expect, it } from "vitest";

import { isStaleHistoryError, refsFromHistoryRecords } from "@/lib/gmail/history";

describe("refsFromHistoryRecords", () => {
  it("collects unique messageAdded refs and skips spam/trash", () => {
    const refs = refsFromHistoryRecords([
      {
        messagesAdded: [
          { message: { id: "m1", threadId: "t1", labelIds: ["INBOX"] } },
          { message: { id: "m1", threadId: "t1", labelIds: ["INBOX"] } },
          { message: { id: "m2", threadId: "t2", labelIds: ["SPAM"] } },
          { message: { id: "m3", threadId: "t3", labelIds: ["TRASH"] } },
          { message: { id: "m4", threadId: "t4", labelIds: ["SENT"] } },
        ],
      },
    ]);
    expect(refs).toEqual([
      { id: "m1", threadId: "t1" },
      { id: "m4", threadId: "t4" },
    ]);
  });
});

describe("isStaleHistoryError", () => {
  it("treats 404/410 history responses as stale", () => {
    expect(isStaleHistoryError({ response: { status: 404 }, message: "Requested entity was not found." })).toBe(true);
    expect(isStaleHistoryError({ status: 410 })).toBe(true);
    expect(isStaleHistoryError({ response: { status: 500 } })).toBe(false);
  });
});
