import { describe, expect, it, vi } from "vitest";

import { scanAppBaseUrl, scheduleScanContinuation } from "@/lib/scans/continue";

describe("scan continuation scheduling", () => {
  it("prefers NEXT_PUBLIC_APP_URL then Vercel URL", () => {
    expect(scanAppBaseUrl({ NEXT_PUBLIC_APP_URL: "https://mail.example/" })).toBe(
      "https://mail.example",
    );
    expect(scanAppBaseUrl({ VERCEL_URL: "mail.vercel.app" })).toBe("https://mail.vercel.app");
    expect(scanAppBaseUrl({})).toBeNull();
  });

  it("posts the scan id with the cron secret", async () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://mail.example");
    vi.stubEnv("CRON_SECRET", "cron-secret");
    const fetchImpl = vi.fn(async () => new Response(null, { status: 202 })) as typeof fetch;
    await expect(
      scheduleScanContinuation("11111111-1111-4111-8111-111111111111", fetchImpl),
    ).resolves.toBe(true);
    expect(fetchImpl).toHaveBeenCalledWith(
      "https://mail.example/api/scans/continue",
      expect.objectContaining({
        method: "POST",
      }),
    );
    vi.unstubAllEnvs();
  });
});
