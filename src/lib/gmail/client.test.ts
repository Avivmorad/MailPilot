import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GmailDeadlineError } from "@/lib/gmail/request-budget";

const mocks = vi.hoisted(() => ({
  getAccessToken: vi.fn(),
  setCredentials: vi.fn(),
  update: vi.fn(),
  gmail: vi.fn(() => ({ users: {} })),
}));

vi.mock("googleapis", () => ({ google: { gmail: mocks.gmail } }));
vi.mock("@/lib/gmail/oauth", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/gmail/oauth")>();
  return {
    ...original,
    createOAuth2Client: () => ({
      getAccessToken: mocks.getAccessToken,
      setCredentials: mocks.setCredentials,
      transporter: { defaults: {} },
    }),
  };
});
vi.mock("@/lib/config/env", () => ({
  getGmailEnv: () => ({ TOKEN_ENCRYPTION_KEY: "synthetic-test-key" }),
}));
vi.mock("@/lib/security/encryption", () => ({
  rotateSecretEnvelope: () => ({ plaintext: "synthetic-refresh-token" }),
}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => {
    const query = {
      select: () => query,
      eq: () => query,
      in: () => query,
      order: () => query,
      limit: () => query,
      update: mocks.update.mockImplementation(() => query),
      maybeSingle: async () => ({
        error: null,
        data: {
          id: "conn-1",
          user_id: "user-1",
          gmail_email: "test@example.com",
          encrypted_refresh_token: "synthetic-ciphertext",
          status: "CONNECTED",
        },
      }),
    };
    return { from: () => query };
  },
}));

import {
  createGmailApi,
  createGmailApiForConnection,
  createGmailApiForUser,
} from "@/lib/gmail/client";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getAccessToken.mockResolvedValue({ token: "synthetic-access-token" });
});
afterEach(() => vi.useRealTimers());

describe("Gmail token refresh", () => {
  it("bounds a hung refresh without changing Gmail consent", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    mocks.getAccessToken.mockImplementationOnce(() => new Promise<never>(() => undefined));
    const result = createGmailApiForUser("user-1", { deadlineAt: 100 });
    const assertion = expect(result).rejects.toBeInstanceOf(GmailDeadlineError);
    await vi.advanceTimersByTimeAsync(100);
    await assertion;
    expect(mocks.update).not.toHaveBeenCalled();
    expect(mocks.gmail).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });
  it("builds a Gmail client after successful refresh", async () => {
    await createGmailApi("synthetic-refresh-token");
    expect(mocks.setCredentials).toHaveBeenCalledWith({
      refresh_token: "synthetic-refresh-token",
    });
    expect(mocks.gmail).toHaveBeenCalledWith(expect.objectContaining({ version: "v1" }));
  });

  describe.each([
    ["user", () => createGmailApiForUser("user-1")],
    ["connection", () => createGmailApiForConnection("conn-1")],
  ] as const)("%s connection status", (_name, createClient) => {
    it.each([
      new Error("ECONNRESET synthetic-sensitive-detail"),
      { response: { status: 429 } },
      { response: { status: 503 } },
      { response: { status: 401, data: { error: "invalid_client" } } },
    ])("keeps consent intact for non-revocation errors: %j", async (error) => {
      mocks.getAccessToken.mockRejectedValueOnce(error);
      await expect(createClient()).rejects.toMatchObject({
        reason: "gmail_unavailable",
        message: "Gmail is temporarily unavailable. Try again in a few minutes.",
      });
      expect(mocks.update).not.toHaveBeenCalled();
      expect(mocks.gmail).not.toHaveBeenCalled();
    });

    it.each([
      new Error("invalid_grant"),
      { response: { status: 400, data: { error: "invalid_grant" } } },
    ])("requires consent again for revoked grants: %j", async (error) => {
      mocks.getAccessToken.mockRejectedValueOnce(error);
      await expect(createClient()).rejects.toMatchObject({ reason: "reauth_required" });
      expect(mocks.update).toHaveBeenCalledWith({ status: "REAUTH_REQUIRED" });
      expect(mocks.gmail).not.toHaveBeenCalled();
    });
  });
});
