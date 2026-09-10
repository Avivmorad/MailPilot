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
});
