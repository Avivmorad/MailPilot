import { describe, expect, it } from "vitest";

import { groupByTopic, topicForItem } from "@/lib/actions/topics";

describe("topicForItem", () => {
  it("maps account to security and finance to payments", () => {
    expect(topicForItem({ category: "account" })).toBe("security");
    expect(topicForItem({ category: "finance" })).toBe("payments");
    expect(topicForItem({ actionType: "pay" })).toBe("payments");
    expect(topicForItem({ category: "work" })).toBe("general");
    expect(topicForItem({ summary: "בדוק את פעילות החשבון שלך ב-Linear" })).toBe("security");
  });
});

describe("groupByTopic", () => {
  it("keeps similar notices under the same heading", () => {
    const grouped = groupByTopic([
      { category: "notification", summary: "בדוק את פעילות החשבון שלך ב-Linear", id: "linear" },
      { category: "notification", summary: "בדוק את פעילות החשבון האחרונה ב-Vercel", id: "vercel" },
      { category: "finance", id: "receipt" },
    ]);
    expect(grouped.map((group) => group.topic)).toEqual(["security", "payments"]);
    expect(grouped[0]?.items).toHaveLength(2);
  });
});
