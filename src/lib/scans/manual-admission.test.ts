import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findRunningScan: vi.fn(),
  getScanCheckpoint: vi.fn(),
  open: vi.fn(),
  resume: vi.fn(),
  execute: vi.fn(),
  provider: vi.fn(),
  acquire: vi.fn(),
  admit: vi.fn(),
  finish: vi.fn(),
  mark: vi.fn(),
}));

vi.mock("@/lib/config/env", () => ({
  isGmailConfigured: () => true,
  isTriageConfigured: () => true,
  getTriageModelName: () => "synthetic-model",
}));
vi.mock("@/lib/ai/client", () => ({ createEmailTriageProvider: mocks.provider }));
vi.mock("@/lib/gmail/client", () => ({
  createGmailApiForUser: async () => ({
    gmail: {},
    connectionId: "conn-1",
    gmailEmail: "test@example.com",
  }),
}));
vi.mock("@/lib/scans/gmail-port", () => ({ createGmailScanPort: () => ({}) }));
vi.mock("@/lib/scans/store", () => ({
  createSupabaseScanStore: () => ({
    findRunningScan: mocks.findRunningScan,
    getScanCheckpoint: mocks.getScanCheckpoint,
  }),
}));
vi.mock("@/lib/scans/process-scan", () => ({
  openGmailScan: mocks.open,
  resumeGmailScan: mocks.resume,
  executeGmailScan: mocks.execute,
}));
vi.mock("@/lib/scans/jobs", () => ({
  acquireScanJob: mocks.acquire,
  admitScanSlice: mocks.admit,
  finishScanJob: mocks.finish,
  markScanJobRunning: mocks.mark,
  SCAN_SLICE_IN_PROGRESS: "scan_slice_in_progress",
}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => {
    const query = {
      select: () => query,
      eq: () => query,
      order: () => query,
      limit: () => query,
      maybeSingle: async () => ({ data: null, error: null }),
    };
    return { from: () => query };
  },
}));

import { beginManualInitialScan } from "@/lib/scans/manual";

beforeEach(() => {
  vi.resetAllMocks();
  mocks.findRunningScan.mockResolvedValue(null);
  mocks.acquire.mockResolvedValue("job-1");
  mocks.admit.mockResolvedValue("job-1");
  mocks.finish.mockResolvedValue(true);
  mocks.mark.mockResolvedValue(true);
  mocks.provider.mockReturnValue({});
  mocks.open.mockResolvedValue({ scanId: "new-scan" });
  mocks.resume.mockResolvedValue({ scanId: "existing-scan" });
});

describe("manual scan preparation lease cleanup", () => {
  it.each(["open", "provider", "mark"] as const)(
    "releases only the admitted worker's lease when %s fails",
    async (stage) => {
      const error = new Error("synthetic preparation failure");
      if (stage === "provider")
        mocks.provider.mockImplementationOnce(() => {
          throw error;
        });
      else mocks[stage].mockRejectedValueOnce(error);
      await expect(beginManualInitialScan("user-1")).rejects.toBe(error);
      expect(mocks.finish).toHaveBeenCalledWith(
        "job-1",
        "FAILED",
        "scan_preparation_failed",
        expect.stringMatching(/^manual:/),
      );
      expect(mocks.execute).not.toHaveBeenCalled();
    },
  );

  it("cleans up its lease when marking the new job returns false", async () => {
    mocks.mark.mockResolvedValueOnce(false);
    await expect(beginManualInitialScan("user-1")).rejects.toMatchObject({ status: 409 });
    expect(mocks.finish).toHaveBeenCalledWith(
      "job-1",
      "FAILED",
      "scan_preparation_failed",
      expect.stringMatching(/^manual:/),
    );
  });

  it("preserves the resumable checkpoint when preparation fails", async () => {
    const checkpoint = {
      scanId: "existing-scan",
      triggerType: "INITIAL",
      discoveryComplete: true,
      discoveredThreadIds: ["t1", "t2"],
      threadCursor: 1,
    };
    mocks.findRunningScan.mockResolvedValueOnce({ id: checkpoint.scanId });
    mocks.getScanCheckpoint.mockResolvedValueOnce(checkpoint);
    const error = new Error("synthetic resume failure");
    mocks.resume.mockRejectedValueOnce(error);
    await expect(beginManualInitialScan("user-1")).rejects.toBe(error);
    expect(mocks.finish).toHaveBeenCalledWith(
      "job-1",
      "FAILED",
      "scan_preparation_failed",
      expect.stringMatching(/^manual:existing-scan:/),
    );
    expect(checkpoint.threadCursor).toBe(1);
    expect(mocks.open).not.toHaveBeenCalled();
    expect(mocks.execute).not.toHaveBeenCalled();
  });

  it("reports cleanup failures instead of silently discarding them", async () => {
    const preparationError = new Error("synthetic preparation failure");
    const cleanupError = new Error("synthetic cleanup failure");
    mocks.open.mockRejectedValueOnce(preparationError);
    mocks.finish.mockRejectedValueOnce(cleanupError);
    await expect(beginManualInitialScan("user-1")).rejects.toMatchObject({
      name: "AggregateError",
      errors: [preparationError, cleanupError],
    });
  });

  it("does not execute or release a successfully prepared slice before execute is called", async () => {
    await expect(beginManualInitialScan("user-1")).resolves.toMatchObject({ scanId: "new-scan" });
    expect(mocks.finish).not.toHaveBeenCalled();
    expect(mocks.execute).not.toHaveBeenCalled();
  });
});
