import { describe, expect, it } from "vitest";

import { isValidOAuthState } from "@/lib/gmail/oauth";

describe("isValidOAuthState", () => {
  it("accepts matching state", () => {
    expect(isValidOAuthState("abc123def", "abc123def")).toBe(true);
  });

  it("rejects missing or mismatched state", () => {
    expect(isValidOAuthState(undefined, "abc")).toBe(false);
    expect(isValidOAuthState("abc", undefined)).toBe(false);
    expect(isValidOAuthState("abc", "abd")).toBe(false);
  });
});
