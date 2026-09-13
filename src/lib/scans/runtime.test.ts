import { describe, expect, it, vi } from "vitest";

import { runScanInBackground } from "@/lib/scans/runtime";

describe("runScanInBackground", () => {
  it("runs execute once even if scheduled twice", async () => {
    const execute = vi.fn(async () => "ok");
    const first = runScanInBackground("scan-1", execute);
    const second = runScanInBackground("scan-1", execute);
    await Promise.all([first, second]);
    expect(execute).toHaveBeenCalledTimes(1);
  });

  it("starts a continue job while the original scan id is still recorded", async () => {
    let release!: () => void;
    const firstExec = vi.fn(
      () =>
        new Promise<string>((resolve) => {
          release = () => resolve("ok");
        }),
    );
    const continueExec = vi.fn(async () => "continued");
    const first = runScanInBackground("scan-1", firstExec);
    const nested = runScanInBackground("scan-1", continueExec, {
      jobKey: "continue:scan-1",
    });
    await Promise.resolve();
    await Promise.resolve();
    expect(continueExec).toHaveBeenCalledTimes(1);
    release();
    await Promise.all([first, nested]);
  });
});
