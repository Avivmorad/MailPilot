import { describe, expect, it, vi } from "vitest";

import { authorizeCronRequest } from "@/lib/scans/cron-auth";
import {
  DISPATCH_BUDGET_MS,
  DISPATCH_DEFAULT_LIMIT,
  DISPATCH_LEASE_SECONDS,
  DISPATCH_MAX_DURATION_SECONDS,
  hasDispatchBudget,
} from "@/lib/scans/dispatch-budget";
import { dispatchDueScans } from "@/lib/scans/dispatcher";

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
    expect(DISPATCH_LEASE_SECONDS).toBe(Math.floor(DISPATCH_BUDGET_MS / 1000));
    expect(DISPATCH_LEASE_SECONDS).toBeLessThan(DISPATCH_MAX_DURATION_SECONDS);
    expect(DISPATCH_DEFAULT_LIMIT).toBe(1);
  });

  it("stops claiming work after the budget elapses", () => {
    const startedAt = 1_000;
    expect(hasDispatchBudget(startedAt, startedAt + DISPATCH_BUDGET_MS - 1)).toBe(true);
    expect(hasDispatchBudget(startedAt, startedAt + DISPATCH_BUDGET_MS)).toBe(false);
  });
});

describe("dispatchDueScans", () => {
  it("stops claiming when the wall-clock budget is already exhausted", async () => {
    const claimDueConnections = vi.fn(async () => [
      { id: "conn-1", userId: "user-1", gmailEmail: "a@example.com" },
    ]);
    const runClaimedConnection = vi.fn(async () => ({
      connectionId: "conn-1",
      status: "SUCCESS" as const,
    }));

    const result = await dispatchDueScans({
      startedAtMs: Date.now() - DISPATCH_BUDGET_MS,
      claimDueConnections,
      runClaimedConnection,
    });

    expect(result).toEqual({ claimed: 0, results: [] });
    expect(claimDueConnections).not.toHaveBeenCalled();
    expect(runClaimedConnection).not.toHaveBeenCalled();
  });

  it("claims one connection at a time until the limit or empty queue", async () => {
    const queue = [
      { id: "conn-1", userId: "user-1", gmailEmail: "a@example.com" },
      { id: "conn-2", userId: "user-2", gmailEmail: "b@example.com" },
    ];
    const claimDueConnections = vi.fn(async () => {
      const next = queue.shift();
      return next ? [next] : [];
    });
    const runClaimedConnection = vi.fn(async (claimed) => ({
      connectionId: claimed.id,
      status: "SUCCESS" as const,
    }));

    const result = await dispatchDueScans({
      limit: 3,
      claimDueConnections,
      runClaimedConnection,
    });

    expect(result.claimed).toBe(2);
    expect(result.results.map((item) => item.connectionId)).toEqual(["conn-1", "conn-2"]);
    expect(claimDueConnections).toHaveBeenCalledTimes(3);
    expect(claimDueConnections).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        limit: 1,
        leaseSeconds: DISPATCH_LEASE_SECONDS,
      }),
    );
  });
});
