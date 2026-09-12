import { describe, expect, it, vi, beforeEach } from "vitest";

import { resetSharedGmailQuotaForTests } from "@/lib/gmail/quota";
import { isGmailAuthError, isGmailQuotaError, withGmailRetry } from "@/lib/gmail/retry";

beforeEach(() => {
  resetSharedGmailQuotaForTests();
});

describe("isGmailQuotaError", () => {
  it("detects Gmail units-per-minute quota errors", () => {
    expect(
      isGmailQuotaError({
        message:
          "Quota exceeded for quota metric 'Total Query Cost' and limit 'Units per minute per user' of service 'gmail.googleapis.com'",
      }),
    ).toBe(true);
    expect(isGmailQuotaError({ response: { status: 429 } })).toBe(true);
    expect(isGmailQuotaError(new Error("gmail list failed"))).toBe(false);
  });
});

describe("isGmailAuthError", () => {
  it("detects 401 and revoked-token messages and does not retry them", async () => {
    expect(isGmailAuthError({ response: { status: 401 } })).toBe(true);
    expect(isGmailAuthError(new Error("invalid_grant"))).toBe(true);
    expect(isGmailAuthError({ response: { status: 429 } })).toBe(false);

    const operation = vi.fn(async () => {
      throw { response: { status: 401 }, message: "invalid_grant" };
    });
    await expect(
      withGmailRetry(operation, { delaysMs: [5], sleep: async () => undefined }),
    ).rejects.toMatchObject({
      response: { status: 401 },
    });
    expect(operation).toHaveBeenCalledTimes(1);
  });
});

describe("withGmailRetry", () => {
  it("retries quota errors then succeeds", async () => {
    let calls = 0;
    const sleep = vi.fn(async () => undefined);
    const result = await withGmailRetry(
      async () => {
        calls += 1;
        if (calls < 2) {
          throw { response: { status: 429 }, message: "Quota exceeded" };
        }
        return "ok";
      },
      { delaysMs: [5], sleep },
    );
    expect(result).toBe("ok");
    expect(sleep).toHaveBeenCalledTimes(1);
  });

  it("acquires quota units before calling Gmail", async () => {
    const operation = vi.fn(async () => "ok");
    const sleep = vi.fn(async () => undefined);
    await withGmailRetry(operation, { units: 10, delaysMs: [], sleep });
    expect(operation).toHaveBeenCalledTimes(1);
    expect(sleep).not.toHaveBeenCalled();
  });
});
