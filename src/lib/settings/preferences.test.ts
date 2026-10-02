import { describe, expect, it } from "vitest";

import {
  CUSTOM_AI_INSTRUCTIONS_MAX,
  isValidTimeZone,
  patchScanPreferencesSchema,
} from "@/lib/settings/preferences";

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

  it("accepts triage lists, digest, and bounded custom instructions", () => {
    expect(
      patchScanPreferencesSchema.parse({
        vipSenders: ["  Ada@Example.com  "],
        ignoredSenders: ["noise@example.com"],
        ignoredDomains: ["@News.Example.com"],
        customAiInstructions: "Prefer career mail.",
        digestEnabled: false,
      }),
    ).toEqual({
      vipSenders: ["ada@example.com"],
      ignoredSenders: ["noise@example.com"],
      ignoredDomains: ["news.example.com"],
      customAiInstructions: "Prefer career mail.",
      digestEnabled: false,
    });
    expect(
      patchScanPreferencesSchema.safeParse({
        customAiInstructions: "x".repeat(CUSTOM_AI_INSTRUCTIONS_MAX + 1),
      }).success,
    ).toBe(false);
    expect(patchScanPreferencesSchema.safeParse({ ignoredDomains: ["not a domain"] }).success).toBe(
      false,
    );
  });
});

describe("isValidTimeZone", () => {
  it("accepts Asia/Jerusalem", () => {
    expect(isValidTimeZone("Asia/Jerusalem")).toBe(true);
  });
});
