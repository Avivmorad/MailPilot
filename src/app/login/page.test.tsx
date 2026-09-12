/** @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

const resetPasswordForEmail = vi.fn(async () => ({ error: null }));

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: {
      signInWithPassword: vi.fn(),
      signUp: vi.fn(),
      resetPasswordForEmail,
    },
  }),
}));

import LoginPage from "@/app/login/page";

afterEach(() => {
  cleanup();
  resetPasswordForEmail.mockClear();
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
          redirectTo: expect.stringContaining("/auth/confirm?next=/login/update-password"),
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
});
