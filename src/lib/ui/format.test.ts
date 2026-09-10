import { describe, expect, it } from "vitest";

import { formatDateTime } from "@/lib/ui/format";

describe("formatDateTime", () => {
  it("formats UTC timestamps in Asia/Jerusalem", () => {
    expect(formatDateTime("2026-09-10T11:10:00.000Z")).toContain("14:10");
  });
});
