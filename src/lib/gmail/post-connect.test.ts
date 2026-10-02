import { beforeEach, describe, expect, it, vi } from "vitest";

const ensureManagedLabels = vi.fn(async () => undefined);
const getScanPreferences = vi.fn(async () => ({
  dailyScanTime: "08:00",
  timezone: "UTC",
}));
const nextDailyScanAt = vi.fn(() => new Date("2026-10-03T08:00:00.000Z"));
const updateEq = vi.fn(async () => ({ error: null }));
const update = vi.fn(() => ({ eq: updateEq }));
const from = vi.fn(() => ({ update }));

vi.mock("@/lib/gmail/labels", () => ({
  ensureManagedLabels: (...args: unknown[]) => ensureManagedLabels(...args),
}));

vi.mock("@/lib/settings/preferences", () => ({
  getScanPreferences: (...args: unknown[]) => getScanPreferences(...args),
}));

vi.mock("@/lib/scans/schedule", () => ({
  nextDailyScanAt: (...args: unknown[]) => nextDailyScanAt(...args),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({ from }),
}));

describe("runGmailPostConnectSetup", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("schedules next_scan_at and ensures MailPilot labels", async () => {
    const { runGmailPostConnectSetup } = await import("@/lib/gmail/post-connect");
    await runGmailPostConnectSetup({
      userId: "user-1",
      connectionId: "conn-1",
      accessToken: "access",
      refreshToken: "refresh",
      nextScanAt: null,
    });

    expect(getScanPreferences).toHaveBeenCalledWith("user-1");
    expect(from).toHaveBeenCalledWith("gmail_connections");
    expect(update).toHaveBeenCalledWith({ next_scan_at: "2026-10-03T08:00:00.000Z" });
    expect(updateEq).toHaveBeenCalledWith("id", "conn-1");
    expect(ensureManagedLabels).toHaveBeenCalledWith("conn-1", "access", "refresh");
  });

  it("skips scheduling when next_scan_at is already set", async () => {
    const { runGmailPostConnectSetup } = await import("@/lib/gmail/post-connect");
    await runGmailPostConnectSetup({
      userId: "user-1",
      connectionId: "conn-1",
      accessToken: "access",
      refreshToken: "refresh",
      nextScanAt: "2026-10-04T08:00:00.000Z",
    });

    expect(getScanPreferences).not.toHaveBeenCalled();
    expect(from).not.toHaveBeenCalled();
    expect(ensureManagedLabels).toHaveBeenCalledWith("conn-1", "access", "refresh");
  });

  it("still ensures labels if schedule setup fails", async () => {
    getScanPreferences.mockRejectedValueOnce(new Error("prefs down"));
    const { runGmailPostConnectSetup } = await import("@/lib/gmail/post-connect");
    await expect(
      runGmailPostConnectSetup({
        userId: "user-1",
        connectionId: "conn-1",
        accessToken: "access",
        refreshToken: "refresh",
        nextScanAt: null,
      }),
    ).resolves.toBeUndefined();
    expect(ensureManagedLabels).toHaveBeenCalledWith("conn-1", "access", "refresh");
  });
});
