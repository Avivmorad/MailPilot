import { beforeEach, describe, expect, it, vi } from "vitest";

type JobRow = {
  id: string;
  gmail_connection_id: string;
  scan_run_id: string | null;
  status: string;
  attempt: number;
  locked_at: string | null;
  locked_by: string | null;
  lease_expires_at: string | null;
  last_error: string | null;
};

type Filter =
  | { kind: "eq"; column: string; value: unknown }
  | { kind: "in"; column: string; value: unknown[] }
  | { kind: "or"; expr: string };

const mockState = {
  jobs: [] as JobRow[],
  nextId: 1,
};

function columnValue(row: JobRow, column: string): unknown {
  switch (column) {
    case "id":
      return row.id;
    case "gmail_connection_id":
      return row.gmail_connection_id;
    case "scan_run_id":
      return row.scan_run_id;
    case "status":
      return row.status;
    case "attempt":
      return row.attempt;
    case "locked_at":
      return row.locked_at;
    case "locked_by":
      return row.locked_by;
    case "lease_expires_at":
      return row.lease_expires_at;
    case "last_error":
      return row.last_error;
    default:
      return undefined;
  }
}

function matchOrPart(row: JobRow, part: string): boolean {
  const nullMatch = /^(\w+)\.is\.null$/.exec(part);
  if (nullMatch) {
    return columnValue(row, nullMatch[1]) == null;
  }
  const lteMatch = /^(\w+)\.lte\.(.*)$/.exec(part);
  if (lteMatch) {
    const value = columnValue(row, lteMatch[1]);
    return typeof value === "string" && value <= lteMatch[2];
  }
  const ltMatch = /^(\w+)\.lt\.(.*)$/.exec(part);
  if (ltMatch) {
    const value = columnValue(row, ltMatch[1]);
    return typeof value === "string" && value < ltMatch[2];
  }
  return false;
}

function matches(row: JobRow, filters: Filter[]): boolean {
  return filters.every((filter) => {
    if (filter.kind === "eq") {
      return columnValue(row, filter.column) === filter.value;
    }
    if (filter.kind === "in") {
      return filter.value.includes(columnValue(row, filter.column));
    }
    return filter.expr.split(",").some((part) => matchOrPart(row, part.trim()));
  });
}

function createBuilder() {
  let action: "select" | "insert" | "update" = "select";
  let insertRow: Record<string, unknown> | null = null;
  let patch: Record<string, unknown> | null = null;
  const filters: Filter[] = [];

  const execute = async (mode: "all" | "single" | "maybe" = "all") => {
    if (action === "insert") {
      const connectionId = String(insertRow?.gmail_connection_id ?? "");
      const conflict = mockState.jobs.some(
        (job) =>
          job.gmail_connection_id === connectionId &&
          (job.status === "QUEUED" || job.status === "RUNNING"),
      );
      if (conflict) {
        return {
          data: null,
          error: {
            code: "23505",
            message:
              'duplicate key value violates unique constraint "scan_jobs_one_active_per_connection"',
          },
        };
      }
      const row: JobRow = {
        id: `job-${mockState.nextId}`,
        gmail_connection_id: connectionId,
        scan_run_id: (insertRow?.scan_run_id as string | null | undefined) ?? null,
        status: String(insertRow?.status ?? "QUEUED"),
        attempt: Number(insertRow?.attempt ?? 0),
        locked_at: (insertRow?.locked_at as string | null | undefined) ?? null,
        locked_by: (insertRow?.locked_by as string | null | undefined) ?? null,
        lease_expires_at: (insertRow?.lease_expires_at as string | null | undefined) ?? null,
        last_error: (insertRow?.last_error as string | null | undefined) ?? null,
      };
      mockState.nextId += 1;
      mockState.jobs.push(row);
      return { data: { id: row.id, attempt: row.attempt }, error: null };
    }

    const matched = mockState.jobs.filter((job) => matches(job, filters));
    if (action === "update" && patch) {
      for (const job of matched) {
        Object.assign(job, patch);
      }
    }
    const data = matched.map((job) => ({ ...job }));
    if (mode === "single") {
      if (data.length !== 1) {
        return { data: null, error: { message: "not found" } };
      }
      return { data: data[0], error: null };
    }
    if (mode === "maybe") {
      return { data: data[0] ?? null, error: null };
    }
    return { data, error: null };
  };

  const builder = {
    select: () => builder,
    insert: (row: Record<string, unknown>) => {
      action = "insert";
      insertRow = row;
      return builder;
    },
    update: (nextPatch: Record<string, unknown>) => {
      action = "update";
      patch = nextPatch;
      return builder;
    },
    eq: (column: string, value: unknown) => {
      filters.push({ kind: "eq", column, value });
      return builder;
    },
    in: (column: string, value: unknown[]) => {
      filters.push({ kind: "in", column, value });
      return builder;
    },
    or: (expr: string) => {
      filters.push({ kind: "or", expr });
      return builder;
    },
    single: () => execute("single"),
    maybeSingle: () => execute("maybe"),
    then(
      onFulfilled: (value: { data: unknown; error: unknown }) => unknown,
      onRejected?: (reason: unknown) => unknown,
    ) {
      return execute("all").then(onFulfilled, onRejected);
    },
  };
  return builder;
}

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: () => createBuilder(),
  }),
}));

describe("scan slice admission", () => {
  const t0 = new Date("2026-09-14T12:00:00.000Z");
  const leaseLive = "2026-09-14T12:04:30.000Z";
  const leaseNext = "2026-09-14T12:09:00.000Z";

  beforeEach(() => {
    mockState.jobs = [];
    mockState.nextId = 1;
  });

  it("creates a job when no active slice holds the connection", async () => {
    const { admitScanSlice } = await import("@/lib/scans/jobs");
    const jobId = await admitScanSlice({
      connectionId: "conn-1",
      scanId: "scan-1",
      workerId: "continue:scan-1:abc",
      leaseExpiresAt: leaseLive,
      now: t0,
    });
    expect(jobId).toBe("job-1");
    expect(mockState.jobs).toHaveLength(1);
    expect(mockState.jobs[0]).toMatchObject({
      status: "RUNNING",
      scan_run_id: "scan-1",
      locked_by: "continue:scan-1:abc",
    });
  });

  it("adopts the handed-off job for the same scan id", async () => {
    const { admitScanSlice, resolveScanSliceJob } = await import("@/lib/scans/jobs");
    const firstId = await admitScanSlice({
      connectionId: "conn-1",
      scanId: "scan-1",
      workerId: "continue:scan-1:abc",
      leaseExpiresAt: leaseLive,
      now: t0,
    });
    await resolveScanSliceJob(firstId, { status: "CONTINUED" }, "continue:scan-1:abc", leaseNext);

    const jobId = await admitScanSlice({
      connectionId: "conn-1",
      scanId: "scan-1",
      workerId: "continue:scan-1:def",
      leaseExpiresAt: leaseNext,
      now: t0,
    });
    expect(jobId).toBe(firstId);
    expect(mockState.jobs[0]).toMatchObject({
      status: "RUNNING",
      scan_run_id: "scan-1",
      locked_by: "continue:scan-1:def",
      lease_expires_at: leaseNext,
    });
  });

  it("blocks a second slice while another worker still holds the lease", async () => {
    const { admitScanSlice, SCAN_SLICE_IN_PROGRESS } = await import("@/lib/scans/jobs");
    await admitScanSlice({
      connectionId: "conn-1",
      scanId: "scan-1",
      workerId: "continue:scan-1:abc",
      leaseExpiresAt: leaseLive,
      now: t0,
    });

    await expect(
      admitScanSlice({
        connectionId: "conn-1",
        scanId: "scan-1",
        workerId: "continue:scan-1:def",
        leaseExpiresAt: leaseNext,
        now: t0,
      }),
    ).rejects.toThrow(SCAN_SLICE_IN_PROGRESS);

    await expect(
      admitScanSlice({
        connectionId: "conn-1",
        scanId: "scan-2",
        workerId: "dispatcher:worker",
        leaseExpiresAt: leaseNext,
        now: t0,
      }),
    ).rejects.toThrow(SCAN_SLICE_IN_PROGRESS);
  });

  it("hands off CONTINUED slices instead of finishing the job", async () => {
    const { admitScanSlice, resolveScanSliceJob } = await import("@/lib/scans/jobs");
    const jobId = await admitScanSlice({
      connectionId: "conn-1",
      scanId: "scan-1",
      workerId: "continue:scan-1:ghi",
      leaseExpiresAt: leaseLive,
      now: t0,
    });
    await resolveScanSliceJob(jobId, { status: "CONTINUED" }, "continue:scan-1:ghi", leaseNext);
    expect(mockState.jobs[0]).toMatchObject({
      status: "RUNNING",
      locked_by: null,
      lease_expires_at: leaseNext,
    });
  });

  it("admits only one of two concurrent workers for the same connection", async () => {
    const { admitScanSlice, SCAN_SLICE_IN_PROGRESS } = await import("@/lib/scans/jobs");
    const results = await Promise.allSettled([
      admitScanSlice({
        connectionId: "conn-1",
        scanId: "scan-1",
        workerId: "manual:scan-1:a",
        leaseExpiresAt: leaseLive,
        now: t0,
      }),
      admitScanSlice({
        connectionId: "conn-1",
        scanId: "scan-1",
        workerId: "dispatcher:worker",
        leaseExpiresAt: leaseNext,
        now: t0,
      }),
    ]);

    const fulfilled = results.filter((result) => result.status === "fulfilled");
    const rejected = results.filter((result) => result.status === "rejected");
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect(rejected[0]).toMatchObject({
      status: "rejected",
      reason: expect.objectContaining({ message: SCAN_SLICE_IN_PROGRESS }),
    });
    expect(mockState.jobs.filter((job) => job.status === "RUNNING")).toHaveLength(1);
  });

  it("does not let a stale worker finish after a newer worker took over", async () => {
    const { admitScanSlice, finishScanJob, stillHoldsScanJob } = await import("@/lib/scans/jobs");
    const oldId = await admitScanSlice({
      connectionId: "conn-1",
      scanId: "scan-1",
      workerId: "continue:scan-1:old",
      leaseExpiresAt: leaseLive,
      now: t0,
    });

    const later = new Date("2026-09-14T12:04:31.000Z");
    const newId = await admitScanSlice({
      connectionId: "conn-1",
      scanId: "scan-1",
      workerId: "continue:scan-1:new",
      leaseExpiresAt: leaseNext,
      now: later,
    });

    expect(newId).not.toBe(oldId);
    expect(await finishScanJob(oldId, "SUCCESS", null, "continue:scan-1:old")).toBe(false);
    expect(await stillHoldsScanJob(oldId, "continue:scan-1:old", later)).toBe(false);
    expect(await stillHoldsScanJob(newId, "continue:scan-1:new", later)).toBe(true);
    expect(mockState.jobs.find((job) => job.id === newId)).toMatchObject({
      status: "RUNNING",
      locked_by: "continue:scan-1:new",
    });
    expect(mockState.jobs.find((job) => job.id === oldId)).toMatchObject({
      status: "FAILED",
      last_error: "stale_lease",
    });
  });

  it("does not expire a job whose lease was renewed before the stale update", async () => {
    const { admitScanSlice, failStaleActiveJobs } = await import("@/lib/scans/jobs");
    await admitScanSlice({
      connectionId: "conn-1",
      scanId: "scan-1",
      workerId: "continue:scan-1:live",
      leaseExpiresAt: leaseLive,
      now: t0,
    });

    await failStaleActiveJobs("conn-1", new Date("2026-09-14T12:04:00.000Z"));
    expect(mockState.jobs[0]).toMatchObject({
      status: "RUNNING",
      locked_by: "continue:scan-1:live",
    });
  });
});
