import { describe, expect, it, vi } from "vitest";

import { GmailMinuteQuota } from "@/lib/gmail/quota";

describe("GmailMinuteQuota", () => {
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
