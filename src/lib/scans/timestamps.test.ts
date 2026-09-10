import { describe, expect, it } from "vitest";

import { timestampOrNull } from "@/lib/scans/timestamps";

describe("timestampOrNull", () => {
  it("keeps parseable ISO datetimes", () => {
    expect(timestampOrNull("2026-09-10T08:00:00.000Z")).toBe("2026-09-10T08:00:00.000Z");
  });

  it("drops free-text values that are not dates", () => {
    expect(timestampOrNull("אתמול")).toBeNull();
    expect(timestampOrNull("yesterday")).toBeNull();
    expect(timestampOrNull(null)).toBeNull();
  });
});
