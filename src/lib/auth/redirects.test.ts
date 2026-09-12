import { describe, expect, it } from "vitest";

import { defaultAuthNext, passwordResetRedirectTo, parseAuthOtpType, safeAuthNext } from "@/lib/auth/redirects";

describe("auth redirects", () => {
  it("defaults recovery links to the password form", () => {
    expect(defaultAuthNext("recovery")).toBe("/login/update-password");
    expect(defaultAuthNext("email")).toBe("/login");
    expect(parseAuthOtpType("recovery")).toBe("recovery");
    expect(parseAuthOtpType("evil")).toBeNull();
  });

  it("rejects open redirects", () => {
    expect(safeAuthNext("https://evil.example/phish", "email")).toBe("/login");
    expect(safeAuthNext("//evil.example", "recovery")).toBe("/login/update-password");
    expect(safeAuthNext("/api/privacy/delete-account", "email")).toBe("/login");
    expect(safeAuthNext("/login/update-password", "recovery")).toBe("/login/update-password");
    expect(safeAuthNext("/dashboard", null)).toBe("/dashboard");
  });

  it("builds a same-origin reset callback", () => {
    expect(passwordResetRedirectTo("https://mailpilot.example/")).toBe(
      "https://mailpilot.example/auth/confirm?next=/login/update-password",
    );
  });
});
