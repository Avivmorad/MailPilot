import { describe, expect, it, vi } from "vitest";

import { cancelScanForUser, type ScanCancelPort } from "@/lib/scans/cancel";
import { ScanRequestError } from "@/lib/scans/manual";

function createPort(
  scan: { id: string; status: string; connectionId: string } | null,
): ScanCancelPort & {
  failRunningScan: ReturnType<typeof vi.fn>;
  releaseLease: ReturnType<typeof vi.fn>;
  failActiveJobs: ReturnType<typeof vi.fn>;
} {
  return {
    loadOwnedScan: async () => scan,
    failRunningScan: vi.fn(async () => undefined),
    releaseLease: vi.fn(async () => undefined),
    failActiveJobs: vi.fn(async () => undefined),
  };
}

describe("cancelScanForUser", () => {
  it("fails a running scan, jobs, and lease without deleting analysis", async () => {
    const port = createPort({
      id: "11111111-1111-4111-8111-111111111111",
      status: "RUNNING",
      connectionId: "conn-1",
    });
    const result = await cancelScanForUser("user-1", "11111111-1111-4111-8111-111111111111", port);
    expect(result.status).toBe("FAILED");
    expect(port.failRunningScan).toHaveBeenCalledWith(
      "11111111-1111-4111-8111-111111111111",
      "cancelled",
      expect.stringMatching(/stopped/i),
    );
    expect(port.failActiveJobs).toHaveBeenCalledWith("conn-1", "cancelled");
    expect(port.releaseLease).toHaveBeenCalledWith("conn-1");
  });

  it("rejects a scan that is not running", async () => {
    const port = createPort({
      id: "11111111-1111-4111-8111-111111111111",
      status: "SUCCESS",
      connectionId: "conn-1",
    });
    await expect(
      cancelScanForUser("user-1", "11111111-1111-4111-8111-111111111111", port),
    ).rejects.toMatchObject({
      status: 409,
      code: "not_running",
    } satisfies Partial<ScanRequestError>);
    expect(port.failRunningScan).not.toHaveBeenCalled();
  });

  it("returns not found for another user's scan", async () => {
    const port = createPort(null);
    await expect(
      cancelScanForUser("user-1", "11111111-1111-4111-8111-111111111111", port),
    ).rejects.toMatchObject({ status: 404, code: "not_found" } satisfies Partial<ScanRequestError>);
  });
});
