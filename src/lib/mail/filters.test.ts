import { describe, expect, it } from "vitest";

import { isStaleWaiting, isUncertainClassification, parseUncertainFilter } from "@/lib/mail/filters";

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

  it("flags waiting items that have not moved in a week", () => {
    const now = new Date("2026-09-12T12:00:00.000Z");
    expect(isStaleWaiting("2026-09-01T00:00:00.000Z", now)).toBe(true);
    expect(isStaleWaiting("2026-09-11T00:00:00.000Z", now)).toBe(false);
  });
});
