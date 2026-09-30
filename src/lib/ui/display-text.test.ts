import { describe, expect, it } from "vitest";

import { displayActionTitle, displayThreadTitle, usableDisplayText } from "@/lib/ui/display-text";

describe("usableDisplayText", () => {
  it("rejects blank and literal nullish strings", () => {
    expect(usableDisplayText(null)).toBeNull();
    expect(usableDisplayText(undefined)).toBeNull();
    expect(usableDisplayText("")).toBeNull();
    expect(usableDisplayText("   ")).toBeNull();
    expect(usableDisplayText("null")).toBeNull();
    expect(usableDisplayText("NULL")).toBeNull();
    expect(usableDisplayText("undefined")).toBeNull();
  });

  it("keeps real titles", () => {
    expect(usableDisplayText(" Invoice ")).toBe("Invoice");
  });
});

describe("displayThreadTitle", () => {
  it("prefers the first usable candidate and never returns blank or null", () => {
    expect(displayThreadTitle(null, "null", "  ", "Budget approval")).toBe("Budget approval");
    expect(displayThreadTitle(null, undefined, "")).toBe("Thread");
  });
});

describe("displayActionTitle", () => {
  it("falls back to Action when every candidate is unusable", () => {
    expect(displayActionTitle(null, "null")).toBe("Action");
    expect(displayActionTitle("Pay invoice")).toBe("Pay invoice");
  });
});
