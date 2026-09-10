import { describe, expect, it } from "vitest";

import { formatDate, formatDateTime, formatRelativeTime, isDeadlineOverdue } from "@/lib/ui/format";

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

describe("isDeadlineOverdue", () => {
  const jerusalemAfternoon = new Date("2026-09-10T12:00:00.000Z");

  it("does not treat today's deadline as overdue", () => {
    expect(isDeadlineOverdue("2026-09-10", jerusalemAfternoon)).toBe(false);
  });

  it("treats yesterday's deadline as overdue", () => {
    expect(isDeadlineOverdue("2026-09-09", jerusalemAfternoon)).toBe(true);
  });

  it("does not treat a missing deadline as overdue", () => {
    expect(isDeadlineOverdue(null, jerusalemAfternoon)).toBe(false);
  });

  it("uses Asia/Jerusalem calendar date, not UTC", () => {
    // 21:30 UTC on 10 Sep is already 00:30 on 11 Sep in Asia/Jerusalem (UTC+3).
    const lateUtc = new Date("2026-09-10T21:30:00.000Z");
    expect(isDeadlineOverdue("2026-09-10", lateUtc)).toBe(true);
    expect(isDeadlineOverdue("2026-09-11", lateUtc)).toBe(false);
  });
});

describe("formatRelativeTime", () => {
  it("uses short relative copy for recent activity", () => {
    const now = new Date("2026-09-10T14:00:00.000Z");
    expect(formatRelativeTime("2026-09-10T13:10:00.000Z", now)).toBe("50m ago");
  });
});
