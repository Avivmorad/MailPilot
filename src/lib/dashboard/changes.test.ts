import { describe, expect, it } from "vitest";

import { formatDashboardChangeLine, summarizeDashboardChanges } from "@/lib/dashboard/changes";

const now = new Date("2026-09-12T12:00:00.000Z");
const since = "2026-09-11T08:00:00.000Z";

describe("summarizeDashboardChanges", () => {
  it("counts new, completed, reopened, overdue, and stale waiting work", () => {
    const summary = summarizeDashboardChanges(
      [
        { status: "OPEN", createdAt: "2026-09-11T10:00:00.000Z", updatedAt: "2026-09-11T10:00:00.000Z", deadline: "2026-09-10" },
        { status: "OPEN", createdAt: "2026-09-01T00:00:00.000Z", updatedAt: "2026-09-11T12:00:00.000Z", deadline: null },
        { status: "COMPLETED", createdAt: "2026-09-01T00:00:00.000Z", updatedAt: "2026-09-11T09:00:00.000Z", deadline: null },
        { status: "COMPLETED", createdAt: "2026-09-01T00:00:00.000Z", updatedAt: "2026-09-10T00:00:00.000Z", deadline: null },
        { status: "WAITING", createdAt: "2026-08-01T00:00:00.000Z", updatedAt: "2026-08-01T00:00:00.000Z", deadline: null },
      ],
      since,
      now,
    );

    expect(summary).toEqual({
      since,
      newOpen: 1,
      completed: 1,
      reopened: 1,
      staleWaiting: 1,
      overdueOpen: 1,
    });
  });
});

describe("formatDashboardChangeLine", () => {
  it("matches the change-focused copy from the review", () => {
    expect(
      formatDashboardChangeLine({
        since,
        newOpen: 3,
        completed: 2,
        reopened: 1,
        staleWaiting: 0,
        overdueOpen: 0,
      }),
    ).toBe("Since last scan: 3 new open tasks, 2 completed, 1 reopened.");
  });

  it("returns a quiet empty state when a scan exists but nothing moved", () => {
    expect(
      formatDashboardChangeLine({
        since,
        newOpen: 0,
        completed: 0,
        reopened: 0,
        staleWaiting: 0,
        overdueOpen: 0,
      }),
    ).toBe("No action changes since the last successful scan.");
  });

  it("leads with overdue and stale when the scan delta is empty", () => {
    expect(
      formatDashboardChangeLine({
        since,
        newOpen: 0,
        completed: 0,
        reopened: 0,
        staleWaiting: 2,
        overdueOpen: 4,
      }),
    ).toBe("4 overdue open tasks, 2 stale waiting items.");
  });
});
