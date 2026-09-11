import { describe, expect, it } from "vitest";

import {
  CATEGORY_LABELS,
  CATEGORY_VALUES,
  categoryPromptLines,
  normalizeCategory,
} from "@/lib/ai/categories";

describe("normalizeCategory", () => {
  it("keeps current taxonomy values", () => {
    expect(normalizeCategory("finance")).toBe("finance");
    expect(normalizeCategory("projects_development")).toBe("projects_development");
    expect(normalizeCategory("other")).toBe("other");
  });

  it("maps legacy spec categories", () => {
    expect(normalizeCategory("work")).toBe("other");
    expect(normalizeCategory("school")).toBe("education");
    expect(normalizeCategory("account")).toBe("security");
    expect(normalizeCategory("shopping")).toBe("shopping_orders");
    expect(normalizeCategory("travel")).toBe("travel_transport");
    expect(normalizeCategory("social")).toBe("social_feeds");
    expect(normalizeCategory("newsletter")).toBe("newsletters_promotions");
    expect(normalizeCategory("promotion")).toBe("newsletters_promotions");
    expect(normalizeCategory("notification")).toBe("other");
  });

  it("falls back to other", () => {
    expect(normalizeCategory(null)).toBe("other");
    expect(normalizeCategory("not-a-category")).toBe("other");
  });
});

describe("category catalog", () => {
  it("ends with other and has a label for every value", () => {
    expect(CATEGORY_VALUES.at(-1)).toBe("other");
    expect(CATEGORY_VALUES).toHaveLength(14);
    for (const id of CATEGORY_VALUES) {
      expect(CATEGORY_LABELS[id].length).toBeGreaterThan(0);
    }
  });

  it("lists every category in the prompt block", () => {
    const block = categoryPromptLines();
    for (const id of CATEGORY_VALUES) {
      expect(block).toContain(`- ${id}:`);
    }
  });
});
