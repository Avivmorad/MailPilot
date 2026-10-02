import { beforeEach, describe, expect, it, vi } from "vitest";

const afterMock = vi.fn((task: () => void) => {
  task();
});
const ensureManagedLabels = vi.fn(async () => undefined);
const exchangeAuthorizationCode = vi.fn();
const fetchGmailIdentity = vi.fn();
const encryptSecret = vi.fn(() => "v1:iv:tag:ciphertext");
const emitProductEvent = vi.fn();
const getScanPreferences = vi.fn(async () => ({
  dailyScanTime: "09:00",
  timezone: "Asia/Jerusalem",
}));
const nextDailyScanAt = vi.fn(() => new Date("2026-09-11T06:00:00.000Z"));

const upsertSelectSingle = vi.fn();
const updateEq = vi.fn(async () => ({ error: null }));
const fromMock = vi.fn((table: string) => {
  if (table === "profiles") {
    return {
      upsert: vi.fn(async () => ({ error: null })),
    };
  }
  if (table === "gmail_connections") {
    return {
      select: vi.fn(() => ({
        neq: vi.fn(() => ({
          ilike: vi.fn(async () => ({ data: [], error: null })),
          eq: vi.fn(async () => ({ data: [], error: null })),
        })),
      })),
      upsert: vi.fn(() => ({
        select: vi.fn(() => ({
          single: upsertSelectSingle,
        })),
      })),
      update: vi.fn(() => ({
        eq: updateEq,
      })),
    };
  }
  throw new Error(`unexpected table ${table}`);
});

vi.mock("next/server", () => ({
  after: (task: () => void) => afterMock(task),
}));

vi.mock("@/lib/config/env", () => ({
  getGmailEnv: () => ({
    TOKEN_ENCRYPTION_KEY: "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
  }),
  isGmailConfigured: () => true,
}));

vi.mock("@/lib/gmail/labels", () => ({
  ensureManagedLabels: (...args: unknown[]) => ensureManagedLabels(...args),
}));

vi.mock("@/lib/gmail/oauth", () => ({
  exchangeAuthorizationCode: (...args: unknown[]) => exchangeAuthorizationCode(...args),
  fetchGmailIdentity: (...args: unknown[]) => fetchGmailIdentity(...args),
  GmailConnectError: class GmailConnectError extends Error {
    constructor(
      readonly reason: string,
      message: string,
    ) {
      super(message);
      this.name = "GmailConnectError";
    }
  },
  revokeRefreshToken: vi.fn(),
}));

vi.mock("@/lib/security/encryption", () => ({
  encryptSecret: (...args: unknown[]) => encryptSecret(...args),
  unwrapSecretWithRotation: vi.fn(),
}));

vi.mock("@/lib/scans/jobs", () => ({
  cancelActiveJobsForConnection: vi.fn(),
}));

vi.mock("@/lib/scans/schedule", () => ({
  nextDailyScanAt: (...args: unknown[]) => nextDailyScanAt(...args),
}));

vi.mock("@/lib/settings/preferences", () => ({
  getScanPreferences: (...args: unknown[]) => getScanPreferences(...args),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({ from: fromMock }),
}));

vi.mock("@/lib/observability/events", () => ({
  emitProductEvent: (...args: unknown[]) => emitProductEvent(...args),
}));

import { completeGmailOAuth } from "@/lib/gmail/connections";
import { GMAIL_CONNECT_RETRY_DELAYS_MS } from "@/lib/gmail/retry";

describe("completeGmailOAuth", () => {
  beforeEach(() => {
    afterMock.mockClear();
    ensureManagedLabels.mockReset();
    ensureManagedLabels.mockResolvedValue(undefined);
    exchangeAuthorizationCode.mockReset();
    fetchGmailIdentity.mockReset();
    encryptSecret.mockClear();
    emitProductEvent.mockClear();
    fromMock.mockClear();
    upsertSelectSingle.mockReset();
    updateEq.mockReset();
    updateEq.mockResolvedValue({ error: null });

    exchangeAuthorizationCode.mockResolvedValue({
      accessToken: "access-token",
      refreshToken: "refresh-token",
      expiryDate: null,
    });
    fetchGmailIdentity.mockResolvedValue({
      email: "user@example.com",
      googleAccountId: null,
    });
    upsertSelectSingle.mockResolvedValue({
      data: {
        id: "conn-1",
        user_id: "user-1",
        gmail_email: "user@example.com",
        google_account_id: null,
        status: "CONNECTED",
        last_successful_scan_at: null,
        next_scan_at: null,
      },
      error: null,
    });
  });

  it("returns as soon as the connection is saved and schedules labels via after()", async () => {
    let resolveLabels: (() => void) | undefined;
    const labelsStarted = new Promise<void>((resolve) => {
      ensureManagedLabels.mockImplementation(
        () =>
          new Promise((done) => {
            resolve();
            resolveLabels = () => done(undefined);
          }),
      );
    });

    const resultPromise = completeGmailOAuth("user-1", "auth-code");
    await labelsStarted;
    const result = await resultPromise;

    expect(result).toMatchObject({
      id: "conn-1",
      gmailEmail: "user@example.com",
      status: "CONNECTED",
    });
    expect(fetchGmailIdentity).toHaveBeenCalledWith("access-token", "refresh-token", {
      delaysMs: GMAIL_CONNECT_RETRY_DELAYS_MS,
    });
    expect(afterMock).toHaveBeenCalledTimes(1);
    expect(ensureManagedLabels).toHaveBeenCalledWith("conn-1", "access-token", "refresh-token", {
      delaysMs: GMAIL_CONNECT_RETRY_DELAYS_MS,
    });
    resolveLabels?.();
  });

  it("still completes connect when deferred label creation fails", async () => {
    ensureManagedLabels.mockRejectedValue(new Error("quota"));
    const result = await completeGmailOAuth("user-1", "auth-code");
    expect(result.id).toBe("conn-1");
    expect(afterMock).toHaveBeenCalledTimes(1);
  });
});
