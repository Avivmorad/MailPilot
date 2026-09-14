import { describe, expect, it } from "vitest";

import {
  defaultAuthNext,
  googleSignInRedirectTo,
  oauthCodeConfirmUrl,
  passwordResetRedirectTo,
  parseAuthOtpType,
  safeAuthNext,
} from "@/lib/auth/redirects";

describe("auth redirects", () => {
  it("defaults recovery links to the password form", () => {
    expect(defaultAuthNext("recovery")).toBe("/login/update-password");
    expect(defaultAuthNext("email")).toBe("/login");
    expect(parseAuthOtpType("recovery")).toBe("recovery");
    expect(parseAuthOtpType("signup")).toBe("signup");
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

  it("builds a same-origin Google sign-in callback to onboarding", () => {
    expect(googleSignInRedirectTo("https://mailpilot.example/")).toBe(
      "https://mailpilot.example/auth/confirm?next=/onboarding",
    );
  });

  it("forwards a Site URL PKCE code to /auth/confirm", () => {
    const forwarded = oauthCodeConfirmUrl(
      new URL("https://gmailpilot-avivmoradteam.vercel.app/?code=abc-123"),
    );
    expect(forwarded?.pathname).toBe("/auth/confirm");
    expect(forwarded?.searchParams.get("code")).toBe("abc-123");
    expect(forwarded?.searchParams.get("next")).toBe("/onboarding");
  });

  it("does not intercept Gmail OAuth or the confirm route", () => {
    expect(
      oauthCodeConfirmUrl(
        new URL("https://gmailpilot.vercel.app/api/gmail/callback?code=gmail-code"),
      ),
    ).toBeNull();
    expect(
      oauthCodeConfirmUrl(
        new URL("https://gmailpilot.vercel.app/auth/confirm?code=abc&next=/onboarding"),
      ),
    ).toBeNull();
  });
});
