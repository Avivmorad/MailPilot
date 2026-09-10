import { describe, expect, it } from "vitest";

import { compareOpenActions } from "@/lib/actions/sort";

describe("compareOpenActions", () => {
  it("sorts by urgency, then deadline, then importance, then latest message", () => {
    const items = [
      { urgency: "normal", deadline: "2026-09-12", importance: "high", latestMessageAt: "2026-09-10T12:00:00.000Z" },
      { urgency: "urgent", deadline: null, importance: "low", latestMessageAt: "2026-09-01T12:00:00.000Z" },
      { urgency: "normal", deadline: "2026-09-11", importance: "medium", latestMessageAt: "2026-09-09T12:00:00.000Z" },
    ];
    const sorted = [...items].sort(compareOpenActions);
    expect(sorted[0]?.urgency).toBe("urgent");
    expect(sorted[1]?.deadline).toBe("2026-09-11");
    expect(sorted[2]?.deadline).toBe("2026-09-12");
  });
});
