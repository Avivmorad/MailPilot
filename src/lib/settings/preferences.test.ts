import { describe, expect, it } from "vitest";

import { isValidTimeZone, patchScanPreferencesSchema } from "@/lib/settings/preferences";

describe("patchScanPreferencesSchema", () => {
  it("accepts a valid daily time", () => {
    expect(patchScanPreferencesSchema.parse({ dailyScanTime: "08:00" })).toEqual({
      dailyScanTime: "08:00",
    });
  });

  it("rejects an empty patch and an invalid timezone", () => {
    expect(patchScanPreferencesSchema.safeParse({}).success).toBe(false);
    expect(patchScanPreferencesSchema.safeParse({ timezone: "Not/AZone" }).success).toBe(false);
  });
});

describe("isValidTimeZone", () => {
  it("accepts Asia/Jerusalem", () => {
    expect(isValidTimeZone("Asia/Jerusalem")).toBe(true);
  });
});
