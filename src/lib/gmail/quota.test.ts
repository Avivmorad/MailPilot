import { describe, expect, it, vi } from "vitest";

import { GmailMinuteQuota } from "@/lib/gmail/quota";
import { GmailDeadlineError } from "@/lib/gmail/request-budget";

describe("GmailMinuteQuota", () => {
  it("does not admit a request whose quota wait exceeds the remaining budget", async () => {
    const quota = new GmailMinuteQuota(5);
    await quota.acquire(5);
    const sleep = vi.fn(async () => undefined);
    await expect(quota.acquire(5, { deadlineAt: Date.now() + 1000, sleep })).rejects.toBeInstanceOf(
      GmailDeadlineError,
    );
    expect(sleep).not.toHaveBeenCalled();
    expect(quota.used(Date.now())).toBe(5);
  });
  it("waits until the oldest units leave the one-minute window", async () => {
    const quota = new GmailMinuteQuota(15, 1_000);
    let now = 0;
    const sleep = vi.fn(async (ms: number) => {
      now += ms;
    });
    const opts = { now: () => now, sleep };

    await quota.acquire(10, opts);
    await quota.acquire(5, opts);
    expect(sleep).not.toHaveBeenCalled();

    await quota.acquire(10, opts);
    expect(sleep).toHaveBeenCalled();
    expect(sleep.mock.calls[0]?.[0]).toBeGreaterThanOrEqual(1_000);
    expect(quota.used(now)).toBeLessThanOrEqual(15);
  });
});
