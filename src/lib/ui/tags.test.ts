import { describe, expect, it } from "vitest";

import { tagColorClasses, tagHint, tagLabel, isVisibleTag } from "@/lib/ui/tags";

describe("tagLabel", () => {
  it("uses product copy for status and category", () => {
    expect(tagLabel("status", "action_required")).toBe("Needs action");
    expect(tagLabel("category", "projects_development")).toBe("Projects & Development");
    expect(tagLabel("category", "account")).toBe("Security");
    expect(tagLabel("action", "follow_up")).toBe("Follow up");
  });
});

describe("tagHint", () => {
  it("explains status, importance, urgency, and action tags", () => {
    expect(tagHint("status", "action_required")).toMatch(/next step/i);
    expect(tagHint("importance", "high")).toMatch(/priority/i);
    expect(tagHint("urgency", "soon")).toMatch(/soon/i);
    expect(tagHint("action", "pay")).toMatch(/payment/i);
  });

  it("does not explain category tags", () => {
    expect(tagHint("category", "finance")).toBeNull();
    expect(tagHint("category", "security")).toBeNull();
  });
});

describe("tagClassName", () => {
  it("gives each catalogued tag its own color class", () => {
    const classes = tagColorClasses();
    expect(classes.length).toBeGreaterThan(20);
    expect(new Set(classes).size).toBe(classes.length);
  });
});

describe("isVisibleTag", () => {
  it("hides empty, none action, and none urgency", () => {
    expect(isVisibleTag("action", "none")).toBe(false);
    expect(isVisibleTag("urgency", "none")).toBe(false);
    expect(isVisibleTag("category", "finance")).toBe(true);
    expect(isVisibleTag("status", null)).toBe(false);
  });
});
