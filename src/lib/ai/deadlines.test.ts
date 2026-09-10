import { describe, expect, it } from "vitest";

import { normalizeDeadline } from "@/lib/ai/deadlines";

describe("normalizeDeadline", () => {
  it("keeps valid ISO calendar dates", () => {
    expect(normalizeDeadline("2026-09-18")).toBe("2026-09-18");
  });

  it("rejects relative phrases and marketing urgency", () => {
    expect(normalizeDeadline("tomorrow")).toBeNull();
    expect(normalizeDeadline("20 minutes")).toBeNull();
    expect(normalizeDeadline("soon")).toBeNull();
  });

  it("rejects invalid calendar days instead of inventing a date", () => {
    expect(normalizeDeadline("2026-02-30")).toBeNull();
    expect(normalizeDeadline("2026-13-01")).toBeNull();
  });

  it("returns null for empty values", () => {
    expect(normalizeDeadline(null)).toBeNull();
    expect(normalizeDeadline("")).toBeNull();
  });
});
