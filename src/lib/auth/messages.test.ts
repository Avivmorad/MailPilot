import { describe, expect, it } from "vitest";

import { authUserMessage } from "@/lib/auth/messages";

describe("authUserMessage", () => {
  it("maps known Supabase errors to safe copy", () => {
    expect(authUserMessage(new Error("Invalid login credentials"))).toBe(
      "Email or password is incorrect.",
    );
    expect(authUserMessage(new Error("Email not confirmed"))).toBe(
      "Check your email to confirm your account, then sign in.",
    );
    expect(authUserMessage(new Error("User already registered"))).toContain("already exists");
    expect(authUserMessage(new Error("otp_expired"))).toContain("expired");
  });

  it("does not echo unknown or sensitive provider text", () => {
    expect(authUserMessage(new Error("JWT kid=abc secret=ya29.token"))).toBe(
      "Something went wrong. Try again in a moment.",
    );
    expect(authUserMessage(new Error("access_denied provider_token=ya29.secret"))).toBe(
      "Google sign-in was cancelled or could not be completed. Try again.",
    );
    expect(authUserMessage(new Error("access_denied provider_token=ya29.secret"))).not.toContain(
      "ya29",
    );
  });
});
