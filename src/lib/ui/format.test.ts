import { describe, expect, it } from "vitest";

import { formatDate, formatDateTime, formatRelativeTime } from "@/lib/ui/format";

describe("formatDateTime", () => {
  it("formats UTC timestamps in Asia/Jerusalem", () => {
    expect(formatDateTime("2026-09-10T11:10:00.000Z")).toContain("14:10");
  });
});

describe("formatDate", () => {
  it("formats ISO calendar dates without the raw year-month-day string", () => {
    expect(formatDate("2026-09-12")).toBe("12 Sep");
  });

  it("returns an em dash when missing", () => {
    expect(formatDate(null)).toBe("—");
  });
});

describe("formatRelativeTime", () => {
  it("uses short relative copy for recent activity", () => {
    const now = new Date("2026-09-10T14:00:00.000Z");
    expect(formatRelativeTime("2026-09-10T13:10:00.000Z", now)).toBe("50m ago");
  });
});
