import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  checkpoint: vi.fn(),
  update: vi.fn(),
  eq: vi.fn(),
  error: null as { message: string } | null,
}));

vi.mock("@/lib/scans/store", () => ({
  createSupabaseScanStore: () => ({ getScanCheckpoint: state.checkpoint }),
}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: (table: string) => {
      if (table !== "gmail_connections") throw new Error("Unexpected table");
      return {
        update: (patch: unknown) => {
          state.update(patch);
          return {
            eq: async (column: string, id: string) => {
              state.eq(column, id);
              return { error: state.error };
            },
          };
        },
      };
    },
  }),
}));

import { chainIfContinued, scheduleContinueFallback } from "@/lib/scans/continue";
import { SCAN_CONTINUE_RETRY_MS } from "@/lib/scans/dispatch-budget";

const SCAN_ID = "11111111-1111-4111-8111-111111111111";
const continued = { status: "CONTINUED", scanId: SCAN_ID };

describe("durable continuation fallback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.error = null;
    state.checkpoint.mockResolvedValue({ connectionId: "connection-1" });
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://synthetic.example");
    vi.stubEnv("CRON_SECRET", "synthetic-secret");
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("schedules the owning connection at the bounded retry timestamp", async () => {
    const now = new Date("2026-09-29T00:00:00.000Z");
    await scheduleContinueFallback("connection-1", now);
    expect(state.update).toHaveBeenCalledWith({
      next_scan_at: new Date(now.getTime() + SCAN_CONTINUE_RETRY_MS).toISOString(),
    });
    expect(state.eq).toHaveBeenCalledWith("id", "connection-1");
  });

  it.each(["http", "network"])(
    "persists a fallback when self-continuation fails (%s)",
    async (kind) => {
      vi.stubGlobal(
        "fetch",
        vi.fn(async () => {
          if (kind === "network") throw new Error("synthetic network failure");
          return new Response(null, { status: 503 });
        }),
      );
      await chainIfContinued(continued);
      expect(state.checkpoint).toHaveBeenCalledWith(SCAN_ID);
      expect(state.update).toHaveBeenCalledTimes(1);
      expect(state.eq).toHaveBeenCalledWith("id", "connection-1");
    },
  );

  it("does not write a fallback when the next slice was accepted", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(null, { status: 202 })),
    );
    await chainIfContinued(continued);
    expect(state.checkpoint).not.toHaveBeenCalled();
    expect(state.update).not.toHaveBeenCalled();
  });

  it("persists a fallback when continuation credentials are absent", async () => {
    vi.stubEnv("CRON_SECRET", "");
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    await chainIfContinued(continued);
    expect(fetch).not.toHaveBeenCalled();
    expect(state.update).toHaveBeenCalledTimes(1);
  });

  it("surfaces a failed fallback write without exposing raw database details", async () => {
    vi.stubEnv("CRON_SECRET", "");
    state.error = { message: "synthetic private database detail" };
    await expect(chainIfContinued(continued)).rejects.toThrow(
      /^Failed to schedule scan continuation fallback$/,
    );
  });

  it("surfaces checkpoint-read failure instead of pretending recovery was scheduled", async () => {
    vi.stubEnv("CRON_SECRET", "");
    state.checkpoint.mockRejectedValueOnce(new Error("synthetic checkpoint unavailable"));
    await expect(chainIfContinued(continued)).rejects.toThrow("synthetic checkpoint unavailable");
    expect(state.update).not.toHaveBeenCalled();
  });

  it("does not recreate a deleted scan when no checkpoint remains", async () => {
    vi.stubEnv("CRON_SECRET", "");
    state.checkpoint.mockResolvedValueOnce(null);
    await chainIfContinued(continued);
    expect(state.update).not.toHaveBeenCalled();
  });
});
