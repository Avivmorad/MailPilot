import { describe, expect, it } from "vitest";

import { authorizeCronRequest } from "@/lib/scans/cron-auth";
import {
  DISPATCH_BUDGET_MS,
  DISPATCH_DEFAULT_LIMIT,
  DISPATCH_LEASE_SECONDS,
  DISPATCH_MAX_DURATION_SECONDS,
  hasDispatchBudget,
} from "@/lib/scans/dispatch-budget";

describe("authorizeCronRequest", () => {
  it("accepts the Vercel Bearer secret", () => {
    const headers = new Headers({ authorization: "Bearer cron-secret" });
    expect(authorizeCronRequest(headers, "cron-secret")).toBe(true);
  });

  it("accepts the x-cron-secret header", () => {
    const headers = new Headers({ "x-cron-secret": "cron-secret" });
    expect(authorizeCronRequest(headers, "cron-secret")).toBe(true);
  });

  it("rejects a missing or wrong secret", () => {
    expect(authorizeCronRequest(new Headers(), "cron-secret")).toBe(false);
    expect(authorizeCronRequest(new Headers({ authorization: "Bearer other" }), "cron-secret")).toBe(
      false,
    );
  });
});

describe("dispatch budget", () => {
  it("stays within the Vercel Hobby maxDuration", () => {
    expect(DISPATCH_MAX_DURATION_SECONDS).toBe(300);
    expect(DISPATCH_LEASE_SECONDS).toBeLessThanOrEqual(DISPATCH_MAX_DURATION_SECONDS);
    expect(DISPATCH_BUDGET_MS).toBeLessThan(DISPATCH_MAX_DURATION_SECONDS * 1000);
    expect(DISPATCH_DEFAULT_LIMIT).toBe(1);
  });

  it("stops claiming work after the budget elapses", () => {
    const startedAt = 1_000;
    expect(hasDispatchBudget(startedAt, startedAt + DISPATCH_BUDGET_MS - 1)).toBe(true);
    expect(hasDispatchBudget(startedAt, startedAt + DISPATCH_BUDGET_MS)).toBe(false);
  });
});
