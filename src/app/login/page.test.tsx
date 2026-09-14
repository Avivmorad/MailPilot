/** @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

type GoogleOAuthCall = {
  provider: string;
  options: Record<string, unknown>;
};
const oauthSuccess = {
  error: null as Error | null,
  data: { provider: "google" as const, url: null },
};
const resetPasswordForEmail = vi.fn(async () => ({ error: null }));
const signInWithOAuth = vi.fn<(args: GoogleOAuthCall) => Promise<typeof oauthSuccess>>(
  async () => oauthSuccess,
);
const signInWithPassword = vi.fn(async () => ({ error: null }));
const signUp = vi.fn(async () => ({ error: null }));

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: {
      signInWithPassword,
      signUp,
      resetPasswordForEmail,
      signInWithOAuth,
    },
  }),
}));

import LoginPage from "@/app/login/page";

afterEach(() => {
  cleanup();
  resetPasswordForEmail.mockClear();
  signInWithOAuth.mockClear();
  signInWithPassword.mockClear();
  signUp.mockClear();
  signInWithOAuth.mockResolvedValue(oauthSuccess);
});

describe("LoginPage", () => {
  it("toggles password visibility and opens forgot-password", async () => {
    render(<LoginPage />);

    const password = screen.getByLabelText("Password");
    expect(password).toHaveAttribute("type", "password");
    fireEvent.click(screen.getByRole("button", { name: "Show password" }));
    expect(password).toHaveAttribute("type", "text");

    fireEvent.click(screen.getByRole("button", { name: "Forgot password?" }));
    expect(screen.getByRole("heading", { level: 1, name: "Reset password" })).toBeInTheDocument();
    expect(screen.queryByLabelText("Password")).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "ada@example.com" } });
    fireEvent.click(screen.getByRole("button", { name: "Send reset link" }));

    await waitFor(() => {
      expect(resetPasswordForEmail).toHaveBeenCalledWith(
        "ada@example.com",
        expect.objectContaining({
          redirectTo: expect.stringContaining("/auth/confirm"),
        }),
      );
    });
    expect(screen.getByRole("status")).toHaveTextContent(/reset link/i);
  });

  it("shows a field error for an empty email", () => {
    render(<LoginPage />);
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Enter a valid email address.");
  });

  it("shows Continue with Google on sign-in and signup, not password reset", () => {
    render(<LoginPage />);

    expect(screen.getByRole("button", { name: "Continue with Google" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Sign up" }));
    expect(
      screen.getByRole("heading", { level: 1, name: "Create your account" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Continue with Google" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
    fireEvent.click(screen.getByRole("button", { name: "Forgot password?" }));
    expect(screen.queryByRole("button", { name: "Continue with Google" })).not.toBeInTheDocument();
  });

  it("starts Google OAuth with the confirm redirect and no extra scopes", async () => {
    render(<LoginPage />);

    fireEvent.click(screen.getByRole("button", { name: "Continue with Google" }));

    await waitFor(() => {
      expect(signInWithOAuth).toHaveBeenCalledTimes(1);
    });
    expect(signInWithOAuth).toHaveBeenCalledWith({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/confirm`,
      },
    });
    const oauthCall = signInWithOAuth.mock.calls[0][0];
    expect(oauthCall).not.toHaveProperty("scopes");
    expect(oauthCall.options).not.toHaveProperty("scopes");
    expect(oauthCall.options).not.toHaveProperty("queryParams");
  });

  it("prevents duplicate Google OAuth requests while loading", async () => {
    let finishOAuth: (() => void) | undefined;
    signInWithOAuth.mockImplementation(
      () =>
        new Promise((resolve) => {
          finishOAuth = () => resolve(oauthSuccess);
        }),
    );

    render(<LoginPage />);
    const googleButton = screen.getByRole("button", { name: "Continue with Google" });
    fireEvent.click(googleButton);
    fireEvent.click(googleButton);

    await waitFor(() => {
      expect(googleButton).toBeDisabled();
    });
    expect(signInWithOAuth).toHaveBeenCalledTimes(1);

    finishOAuth?.();
    await waitFor(() => {
      expect(signInWithOAuth).toHaveBeenCalledTimes(1);
    });
  });

  it("shows a safe message when Google OAuth fails", async () => {
    signInWithOAuth.mockResolvedValueOnce({
      error: new Error("access_denied provider_token=ya29.secret"),
      data: { provider: "google", url: null },
    });

    render(<LoginPage />);
    fireEvent.click(screen.getByRole("button", { name: "Continue with Google" }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(
        "Google sign-in was cancelled or could not be completed. Try again.",
      );
    });
    expect(screen.getByRole("alert").textContent).not.toMatch(/ya29|provider_token/i);
  });
});
