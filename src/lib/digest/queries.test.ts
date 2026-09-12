import { describe, expect, it } from "vitest";

import { chunkIds, mapDigestReportRow } from "@/lib/digest/queries";

describe("mapDigestReportRow", () => {
  it("maps digest columns and drops invalid action cards", () => {
    expect(
      mapDigestReportRow({
        id: "d1",
        user_id: "u1",
        gmail_connection_id: "c1",
        period_start: "2026-09-10T00:00:00.000Z",
        period_end: "2026-09-11T00:00:00.000Z",
        total_messages: 4,
        important_count: 1,
        action_count: 2,
        reply_count: 1,
        waiting_count: 0,
        informational_count: 1,
        ignored_count: 0,
        summary_text: "Processed 4 emails in this period.",
        top_actions: [
          {
            threadId: "t1",
            title: "Pay invoice",
            urgency: "soon",
            deadline: null,
            category: "finance",
          },
          { threadId: "bad" },
        ],
        created_at: "2026-09-11T08:00:00.000Z",
      }),
    ).toEqual({
      id: "d1",
      userId: "u1",
      connectionId: "c1",
      periodStart: "2026-09-10T00:00:00.000Z",
      periodEnd: "2026-09-11T00:00:00.000Z",
      totalMessages: 4,
      importantCount: 1,
      actionCount: 2,
      replyCount: 1,
      waitingCount: 0,
      informationalCount: 1,
      ignoredCount: 0,
      summaryText: "Processed 4 emails in this period.",
      topActions: [
        {
          threadId: "t1",
          title: "Pay invoice",
          urgency: "soon",
          deadline: null,
          category: "finance",
        },
      ],
      createdAt: "2026-09-11T08:00:00.000Z",
    });
  });

  it("chunks long id lists so PostgREST .in() filters stay under the URL limit", () => {
    const ids = Array.from({ length: 250 }, (_, index) => `id-${index}`);
    const chunks = chunkIds(ids, 100);
    expect(chunks).toHaveLength(3);
    expect(chunks[0]).toHaveLength(100);
    expect(chunks[1]).toHaveLength(100);
    expect(chunks[2]).toHaveLength(50);
    expect(chunkIds([], 100)).toEqual([]);
  });
});
