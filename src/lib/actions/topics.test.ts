import { describe, expect, it } from "vitest";

import { ACTION_TOPIC_LABELS, groupByTopic, topicForItem } from "@/lib/actions/topics";

describe("topicForItem", () => {
  it("uses the stored category when it is in the current taxonomy", () => {
    expect(topicForItem({ category: "finance" })).toBe("finance");
    expect(topicForItem({ category: "career" })).toBe("career");
    expect(topicForItem({ category: "shopping_orders" })).toBe("shopping_orders");
    expect(topicForItem({ category: "projects_development" })).toBe("projects_development");
  });

  it("maps legacy categories onto the new buckets", () => {
    expect(topicForItem({ category: "account" })).toBe("security");
    expect(topicForItem({ category: "school" })).toBe("education");
    expect(topicForItem({ category: "shopping" })).toBe("shopping_orders");
    expect(topicForItem({ category: "work" })).toBe("other");
    expect(topicForItem({ actionType: "pay" })).toBe("finance");
  });

  it("keeps login and security notices under Security", () => {
    expect(topicForItem({ summary: "בדוק את פעילות החשבון שלך ב-Linear" })).toBe("security");
  });
});

describe("groupByTopic", () => {
  it("groups by category in catalog order and keeps similar notices together", () => {
    const grouped = groupByTopic([
      { category: "notification", summary: "בדוק את פעילות החשבון שלך ב-Linear", id: "linear" },
      { category: "notification", summary: "בדוק את פעילות החשבון האחרונה ב-Vercel", id: "vercel" },
      { category: "finance", id: "receipt" },
      { category: "career", id: "job" },
    ]);
    expect(grouped.map((group) => group.topic)).toEqual(["finance", "security", "career"]);
    expect(grouped[1]?.items).toHaveLength(2);
  });
});

describe("ACTION_TOPIC_LABELS", () => {
  it("uses English headings in the product UI", () => {
    expect(ACTION_TOPIC_LABELS.finance).toBe("Finance");
    expect(ACTION_TOPIC_LABELS.security).toBe("Security");
    expect(ACTION_TOPIC_LABELS.projects_development).toBe("Projects & Development");
    expect(ACTION_TOPIC_LABELS.official_legal).toBe("Official, Legal & Insurance");
    expect(ACTION_TOPIC_LABELS.other).toBe("Other");
  });
});
