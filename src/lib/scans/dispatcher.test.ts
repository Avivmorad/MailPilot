import { describe, expect, it, vi } from "vitest";

import { resetProductEventSink, setProductEventSink } from "@/lib/observability/events";
import { authorizeCronRequest } from "@/lib/scans/cron-auth";
import {
  DISPATCH_BUDGET_MS,
  DISPATCH_CHAIN_ATTEMPTS,
  DISPATCH_CYCLE_MAX_SLICES,
  DISPATCH_DEFAULT_LIMIT,
  DISPATCH_LEASE_SECONDS,
  DISPATCH_MAX_DURATION_SECONDS,
  hasDispatchBudget,
} from "@/lib/scans/dispatch-budget";
import { scanHasRemainingWork } from "@/lib/scans/checkpoint";
import {
  dispatchDueScans,
  parseDispatchSlice,
  runDispatchCycle,
  scheduleDispatchSlice,
} from "@/lib/scans/dispatcher";
import type { ScanCheckpoint } from "@/lib/scans/types";

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
    expect(
      authorizeCronRequest(new Headers({ authorization: "Bearer other" }), "cron-secret"),
    ).toBe(false);
    expect(authorizeCronRequest(new Headers({ authorization: "Bearer cron-secret" }), "")).toBe(
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
    expect(DISPATCH_CYCLE_MAX_SLICES).toBeGreaterThan(DISPATCH_DEFAULT_LIMIT);
    expect(DISPATCH_CYCLE_MAX_SLICES).toBeGreaterThanOrEqual(20);
    expect(DISPATCH_CHAIN_ATTEMPTS).toBeGreaterThanOrEqual(2);
  });

  it("stops claiming work after the budget elapses", () => {
    const startedAt = 1_000;
    expect(hasDispatchBudget(startedAt, startedAt + DISPATCH_BUDGET_MS - 1)).toBe(true);
    expect(hasDispatchBudget(startedAt, startedAt + DISPATCH_BUDGET_MS)).toBe(false);
  });
});

describe("dispatcher resume selection", () => {
  it("keeps resuming checkpoints with remaining work even when progress is stale", () => {
    const staleCheckpoint: ScanCheckpoint = {
      scanId: "scan-1",
      userId: "user-1",
      connectionId: "conn-1",
      triggerType: "MANUAL",
      lookbackDays: 30,
      discoveryMode: "INITIAL",
      discoveryComplete: true,
      discoveredThreadIds: ["t1", "t2", "t3"],
      threadCursor: 1,
      historyBoundary: "hist-1",
      failedThreadIds: [],
      messagesDiscovered: 3,
      messagesProcessed: 1,
      threadsAnalyzed: 1,
      importantCount: 0,
      actionCount: 0,
      replyCount: 0,
      waitingCount: 0,
      informationalCount: 0,
      ignoredCount: 0,
      startedAt: "2026-09-14T10:00:00.000Z",
      updatedAt: "2026-09-14T10:00:00.000Z",
    };
    expect(scanHasRemainingWork(staleCheckpoint)).toBe(true);
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

function dueQueue(ids: string[]) {
  const queue = ids.map((id) => ({
    id,
    userId: `user-${id}`,
    gmailEmail: `${id}@example.com`,
  }));
  const claimDueConnections = vi.fn(async () => {
    const next = queue.shift();
    return next ? [next] : [];
  });
  const runClaimedConnection = vi.fn(async (claimed: { id: string }) => ({
    connectionId: claimed.id,
    status: "SUCCESS" as const,
  }));
  return { queue, claimDueConnections, runClaimedConnection };
}

describe("scheduleDispatchSlice", () => {
  it("retries until the next slice accepts", async () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://mail.example");
    vi.stubEnv("CRON_SECRET", "cron-secret");
    let calls = 0;
    const fetchImpl = vi.fn(async () => {
      calls += 1;
      if (calls < DISPATCH_CHAIN_ATTEMPTS) {
        throw new Error("network");
      }
      return new Response(null, { status: 202 });
    }) as typeof fetch;

    try {
      await expect(scheduleDispatchSlice(2, fetchImpl)).resolves.toBe(true);
      expect(fetchImpl).toHaveBeenCalledTimes(DISPATCH_CHAIN_ATTEMPTS);
      const [url, init] = vi.mocked(fetchImpl).mock.calls[0] ?? [];
      expect(url).toBe("https://mail.example/api/cron/scan-dispatcher");
      expect(url).not.toContain("cron-secret");
      expect(init).toEqual(
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ slice: 2 }),
        }),
      );
      expect(JSON.stringify(init?.body)).not.toMatch(/@|bearer|cron-secret/i);
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it("stops after the attempt budget when every start fails", async () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://mail.example");
    vi.stubEnv("CRON_SECRET", "cron-secret");
    const fetchImpl = vi.fn(async () => new Response(null, { status: 503 })) as typeof fetch;
    try {
      await expect(scheduleDispatchSlice(1, fetchImpl)).resolves.toBe(false);
      expect(fetchImpl).toHaveBeenCalledTimes(DISPATCH_CHAIN_ATTEMPTS);
    } finally {
      vi.unstubAllEnvs();
    }
  });
});

describe("parseDispatchSlice", () => {
  it("starts a Vercel GET cron at slice 0 and rejects a slice past the cap", async () => {
    await expect(
      parseDispatchSlice(new Request("https://mail.example/api/cron/scan-dispatcher")),
    ).resolves.toEqual({
      ok: true,
      slice: 0,
    });
    await expect(
      parseDispatchSlice(
        new Request("https://mail.example/api/cron/scan-dispatcher", {
          method: "POST",
          body: JSON.stringify({ slice: 4 }),
        }),
      ),
    ).resolves.toEqual({ ok: true, slice: 4 });
    await expect(
      parseDispatchSlice(
        new Request("https://mail.example/api/cron/scan-dispatcher", {
          method: "POST",
          body: JSON.stringify({ slice: DISPATCH_CYCLE_MAX_SLICES }),
        }),
      ),
    ).resolves.toEqual({ ok: false });
  });
});

describe("runDispatchCycle", () => {
  it("retries later due connections in the same daily cycle or raises a backlog alert", async () => {
    const lines: string[] = [];
    setProductEventSink((line) => {
      lines.push(line);
    });
    try {
      const waiting = dueQueue(["conn-1", "conn-2", "conn-3"]);
      const scheduled: number[] = [];
      const continued = await runDispatchCycle({
        slice: 0,
        claimDueConnections: waiting.claimDueConnections,
        runClaimedConnection: waiting.runClaimedConnection,
        countDueConnections: async () => waiting.queue.length,
        scheduleNextSlice: async (slice) => {
          scheduled.push(slice);
          return true;
        },
      });

      expect(continued.claimed).toBe(DISPATCH_DEFAULT_LIMIT);
      expect(continued.results.map((item) => item.connectionId)).toEqual(["conn-1"]);
      expect(waiting.claimDueConnections).toHaveBeenCalledTimes(1);
      expect(continued.remainingDue).toBe(2);
      expect(scheduled).toEqual([1]);
      expect(continued.chained).toBe(true);
      expect(continued.backlog).toBe(false);
      expect(lines.some((line) => line.includes("scan.dispatch_backlog"))).toBe(false);

      const stuck = dueQueue(["conn-a", "conn-b"]);
      const blockedSchedule = vi.fn(async () => false);
      const blocked = await runDispatchCycle({
        slice: 0,
        claimDueConnections: stuck.claimDueConnections,
        runClaimedConnection: stuck.runClaimedConnection,
        countDueConnections: async () => stuck.queue.length,
        scheduleNextSlice: blockedSchedule,
      });

      expect(blocked.claimed).toBe(1);
      expect(blocked.remainingDue).toBe(1);
      expect(blocked.chained).toBe(false);
      expect(blocked.backlog).toBe(true);
      expect(blockedSchedule).toHaveBeenCalledTimes(1);
      expect(blockedSchedule).toHaveBeenCalledWith(1);
      const alert = lines
        .map((line) => JSON.parse(line) as { type?: string })
        .find((event) => event.type === "scan.dispatch_backlog");
      expect(alert).toMatchObject({
        type: "scan.dispatch_backlog",
        status: "backlog",
        errorCode: "dispatch_backlog",
        slice: 0,
        remainingDue: 1,
        claimed: 1,
      });
      expect(JSON.stringify(alert)).not.toMatch(/@example\.com|cron-secret|bearer/i);
    } finally {
      resetProductEventSink();
    }
  });

  it("raises a backlog alert at the slice cap while accounts are still due", async () => {
    const waiting = dueQueue(["conn-1", "conn-2"]);
    const scheduleNextSlice = vi.fn(async () => true);
    const result = await runDispatchCycle({
      slice: DISPATCH_CYCLE_MAX_SLICES - 1,
      claimDueConnections: waiting.claimDueConnections,
      runClaimedConnection: waiting.runClaimedConnection,
      countDueConnections: async () => waiting.queue.length,
      scheduleNextSlice,
    });

    expect(result.claimed).toBe(1);
    expect(result.remainingDue).toBe(1);
    expect(result.chained).toBe(false);
    expect(result.backlog).toBe(true);
    expect(scheduleNextSlice).not.toHaveBeenCalled();
  });

  it("does not chain or alert when the due queue is drained", async () => {
    const waiting = dueQueue(["conn-1"]);
    const scheduleNextSlice = vi.fn(async () => true);
    const result = await runDispatchCycle({
      slice: 0,
      claimDueConnections: waiting.claimDueConnections,
      runClaimedConnection: waiting.runClaimedConnection,
      countDueConnections: async () => 0,
      scheduleNextSlice,
    });

    expect(result).toMatchObject({
      claimed: 1,
      remainingDue: 0,
      chained: false,
      backlog: false,
    });
    expect(scheduleNextSlice).not.toHaveBeenCalled();
  });
});
