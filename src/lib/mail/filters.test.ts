import { describe, expect, it } from "vitest";

import {
  categoryFilterCounts,
  filterByCategory,
  isStaleWaiting,
  isUncertainClassification,
  parseCategoryFilter,
  parseUncertainFilter,
} from "@/lib/mail/filters";

describe("mail filters", () => {
  it("treats confidence below 0.8 as uncertain", () => {
    expect(isUncertainClassification(0.9)).toBe(false);
    expect(isUncertainClassification(0.7)).toBe(true);
    expect(isUncertainClassification(0.4)).toBe(true);
    expect(isUncertainClassification(null)).toBe(false);
  });

  it("parses the uncertain query flag", () => {
    expect(parseUncertainFilter("1")).toBe(true);
    expect(parseUncertainFilter("true")).toBe(true);
    expect(parseUncertainFilter("0")).toBe(false);
    expect(parseUncertainFilter(undefined)).toBe(false);
  });

  it("parses a category label and ignores unknown values", () => {
    expect(parseCategoryFilter("finance")).toBe("finance");
    expect(parseCategoryFilter(" Finance ")).toBe("finance");
    expect(parseCategoryFilter("account")).toBeNull();
    expect(parseCategoryFilter(["security"])).toBe("security");
    expect(parseCategoryFilter(undefined)).toBeNull();
  });

  it("filters a mail tab by the same topic label used for grouping", () => {
    const items = [
      { id: "invoice", category: "finance" },
      { id: "login", category: "other", summary: "בדוק את פעילות החשבון שלך ב-Linear" },
      { id: "job", category: "career" },
    ];
    expect(filterByCategory(items, "finance").map((item) => item.id)).toEqual(["invoice"]);
    expect(filterByCategory(items, null)).toHaveLength(3);
    expect(categoryFilterCounts(items, "education")).toEqual([
      { category: "finance", count: 1 },
      { category: "security", count: 1 },
      { category: "career", count: 1 },
      { category: "education", count: 0 },
    ]);
  });

  it("flags waiting items that have not moved in a week", () => {
    const now = new Date("2026-09-12T12:00:00.000Z");
    expect(isStaleWaiting("2026-09-01T00:00:00.000Z", now)).toBe(true);
    expect(isStaleWaiting("2026-09-11T00:00:00.000Z", now)).toBe(false);
  });
});
