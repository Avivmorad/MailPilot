import { describe, expect, it } from "vitest";

import { isInboxSummaryStatus, mapRecentThreadRow } from "@/lib/threads/queries";

describe("isInboxSummaryStatus", () => {
  it("keeps quick updates and excludes ignore and tasks", () => {
    expect(isInboxSummaryStatus("informational")).toBe(true);
    expect(isInboxSummaryStatus("resolved")).toBe(true);
    expect(isInboxSummaryStatus("ignore")).toBe(false);
    expect(isInboxSummaryStatus("action_required")).toBe(false);
    expect(isInboxSummaryStatus("waiting")).toBe(false);
  });
});

describe("mapRecentThreadRow", () => {
  it("maps list columns onto RecentThreadRow", () => {
    expect(
      mapRecentThreadRow({
        id: "thread-1",
        short_display_title: "Bank receipt",
        summary: "Payment posted.",
        status: "ignore",
        importance: "low",
        category: "finance",
        latest_message_at: "2026-09-10T10:00:00.000Z",
      }),
    ).toEqual({
      id: "thread-1",
      shortDisplayTitle: "Bank receipt",
      summary: "Payment posted.",
      status: "ignore",
      importance: "low",
      category: "finance",
      latestMessageAt: "2026-09-10T10:00:00.000Z",
    });
  });
});
