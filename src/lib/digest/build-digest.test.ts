import { describe, expect, it } from "vitest";

import {
  buildDigestSummaryText,
  computeDigestPeriodCounts,
  digestListQuerySchema,
  uniqueTopActions,
} from "@/lib/digest/build-digest";

describe("uniqueTopActions", () => {
  it("keeps one card per thread and respects the limit", () => {
    const unique = uniqueTopActions(
      [
        { threadId: "t1", title: "Pay invoice", urgency: "urgent", deadline: null, category: "finance" },
        { threadId: "t1", title: "Pay invoice again", urgency: "soon", deadline: null, category: "finance" },
        { threadId: "t2", title: "Reply to Ada", urgency: "soon", deadline: null, category: "work" },
        { threadId: "t3", title: "Sign form", urgency: "normal", deadline: null, category: "work" },
      ],
      2,
    );
    expect(unique).toEqual([
      { threadId: "t1", title: "Pay invoice", urgency: "urgent", deadline: null, category: "finance" },
      { threadId: "t2", title: "Reply to Ada", urgency: "soon", deadline: null, category: "work" },
    ]);
  });
});

describe("computeDigestPeriodCounts", () => {
  it("counts unique messages and unique active threads from the DB rows", () => {
    const counts = computeDigestPeriodCounts(
      [
        { id: "m1", threadId: "t-action" },
        { id: "m1", threadId: "t-action" },
        { id: "m2", threadId: "t-action" },
        { id: "m3", threadId: "t-info" },
        { id: "m4", threadId: "t-ignore" },
        { id: "m5", threadId: "t-wait" },
      ],
      [
        {
          id: "t-action",
          status: "action_required",
          importance: "high",
          requiresAction: true,
          requiresReply: true,
        },
        {
          id: "t-info",
          status: "informational",
          importance: "low",
          requiresAction: false,
          requiresReply: false,
        },
        {
          id: "t-ignore",
          status: "ignore",
          importance: "low",
          requiresAction: false,
          requiresReply: false,
        },
        {
          id: "t-wait",
          status: "waiting",
          importance: "medium",
          requiresAction: false,
          requiresReply: false,
        },
      ],
    );

    expect(counts).toEqual({
      totalMessages: 5,
      importantCount: 2,
      actionCount: 1,
      replyCount: 1,
      waitingCount: 1,
      informationalCount: 1,
      ignoredCount: 1,
    });
  });
});

describe("buildDigestSummaryText", () => {
  it("describes an empty period and a populated period", () => {
    expect(
      buildDigestSummaryText({
        totalMessages: 0,
        importantCount: 0,
        actionCount: 0,
        replyCount: 0,
        waitingCount: 0,
        informationalCount: 0,
        ignoredCount: 0,
      }),
    ).toBe("No mail was processed in this period.");

    expect(
      buildDigestSummaryText({
        totalMessages: 1,
        importantCount: 1,
        actionCount: 1,
        replyCount: 1,
        waitingCount: 0,
        informationalCount: 0,
        ignoredCount: 0,
      }),
    ).toBe(
      "Processed 1 email in this period. 1 thread needs action, 0 waiting, 0 FYI, and 0 ignored. 1 was marked important.",
    );
  });
});

describe("digestListQuerySchema", () => {
  it("defaults and rejects invalid limits", () => {
    expect(digestListQuerySchema.parse({}).limit).toBe(20);
    expect(digestListQuerySchema.safeParse({ limit: "0" }).success).toBe(false);
    expect(digestListQuerySchema.parse({ limit: "5" }).limit).toBe(5);
  });
});
