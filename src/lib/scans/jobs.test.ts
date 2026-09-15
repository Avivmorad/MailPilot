import { beforeEach, describe, expect, it, vi } from "vitest";

const mockState = {
  activeJob: null as {
    id: string;
    scan_run_id: string | null;
    status: string;
    lease_expires_at: string | null;
  } | null,
  insertedJobId: "job-new",
  updates: [] as Array<Record<string, unknown>>,
};

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          in: () => ({
            maybeSingle: async () => ({
              data: mockState.activeJob,
              error: null,
            }),
          }),
          single: async () => ({
            data: { attempt: 0 },
            error: null,
          }),
        }),
      }),
      insert: () => ({
        select: () => ({
          single: async () => ({
            data: { id: mockState.insertedJobId, attempt: 0 },
            error: null,
          }),
        }),
      }),
      update: (patch: Record<string, unknown>) => ({
        eq: () => ({
          eq: async () => {
            mockState.updates.push(patch);
            return { error: null };
          },
          in: async () => {
            mockState.updates.push(patch);
            return { error: null };
          },
          async then(onFulfilled: (value: { error: null }) => unknown) {
            mockState.updates.push(patch);
            return onFulfilled({ error: null });
          },
        }),
        in: async () => {
          mockState.updates.push(patch);
          return { error: null };
        },
      }),
    }),
  }),
}));

describe("scan slice admission", () => {
  beforeEach(() => {
    mockState.activeJob = null;
    mockState.updates = [];
  });

  it("creates a job when no active slice holds the connection", async () => {
    const { admitScanSlice } = await import("@/lib/scans/jobs");
    const jobId = await admitScanSlice({
      connectionId: "conn-1",
      scanId: "scan-1",
      workerId: "continue:scan-1:abc",
      leaseExpiresAt: "2026-09-14T12:00:00.000Z",
    });
    expect(jobId).toBe("job-new");
    expect(mockState.updates.some((patch) => patch.status === "RUNNING")).toBe(true);
  });

  it("adopts the active job for the same scan id", async () => {
    mockState.activeJob = {
      id: "job-live",
      scan_run_id: "scan-1",
      status: "RUNNING",
      lease_expires_at: "2026-09-14T12:00:00.000Z",
    };
    const { admitScanSlice } = await import("@/lib/scans/jobs");
    const jobId = await admitScanSlice({
      connectionId: "conn-1",
      scanId: "scan-1",
      workerId: "continue:scan-1:def",
      leaseExpiresAt: "2026-09-14T12:05:00.000Z",
    });
    expect(jobId).toBe("job-live");
    expect(mockState.updates.some((patch) => patch.locked_by === "continue:scan-1:def")).toBe(
      true,
    );
  });

  it("blocks a second slice for the same connection", async () => {
    mockState.activeJob = {
      id: "job-live",
      scan_run_id: "scan-1",
      status: "RUNNING",
      lease_expires_at: "2026-09-14T12:00:00.000Z",
    };
    const { admitScanSlice, SCAN_SLICE_IN_PROGRESS } = await import("@/lib/scans/jobs");
    await expect(
      admitScanSlice({
        connectionId: "conn-1",
        scanId: "scan-2",
        workerId: "dispatcher:worker",
        leaseExpiresAt: "2026-09-14T12:05:00.000Z",
      }),
    ).rejects.toThrow(SCAN_SLICE_IN_PROGRESS);
  });

  it("extends the lease for CONTINUED slices instead of finishing the job", async () => {
    const { resolveScanSliceJob } = await import("@/lib/scans/jobs");
    await resolveScanSliceJob(
      "job-live",
      { status: "CONTINUED" },
      "continue:scan-1:ghi",
      "2026-09-14T12:10:00.000Z",
    );
    expect(mockState.updates.some((patch) => patch.lease_expires_at === "2026-09-14T12:10:00.000Z")).toBe(
      true,
    );
    expect(mockState.updates.some((patch) => patch.status === "SUCCESS")).toBe(false);
  });
});
