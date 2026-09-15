import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const exchangeCodeForSession = vi.fn();
const verifyOtp = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    auth: {
      exchangeCodeForSession,
      verifyOtp,
    },
  })),
}));

import { GET } from "@/app/auth/confirm/route";

describe("GET /auth/confirm", () => {
  beforeEach(() => {
    exchangeCodeForSession.mockReset();
    verifyOtp.mockReset();
    exchangeCodeForSession.mockResolvedValue({ error: null });
    verifyOtp.mockResolvedValue({ error: null });
  });

  it("exchanges a PKCE code and redirects to onboarding", async () => {
    const request = new NextRequest(
      "http://localhost:3000/auth/confirm?code=pkce-code&next=/onboarding",
    );

    const response = await GET(request);

    expect(exchangeCodeForSession).toHaveBeenCalledWith("pkce-code");
    expect(verifyOtp).not.toHaveBeenCalled();
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("http://localhost:3000/onboarding");
  });

  it("exchanges a PKCE code without next and redirects to onboarding", async () => {
    const request = new NextRequest("http://localhost:3000/auth/confirm?code=pkce-code");

    const response = await GET(request);

    expect(exchangeCodeForSession).toHaveBeenCalledWith("pkce-code");
    expect(response.headers.get("location")).toBe("http://localhost:3000/onboarding");
  });

  it("maps cancelled Google OAuth to a Google error instead of an expired link", async () => {
    const request = new NextRequest(
      "http://localhost:3000/auth/confirm?error=access_denied&next=/onboarding",
    );

    const response = await GET(request);
    const location = new URL(response.headers.get("location") ?? "");

    expect(exchangeCodeForSession).not.toHaveBeenCalled();
    expect(location.pathname).toBe("/login");
    expect(location.searchParams.get("error")).toBe("google_oauth");
  });

  it("sends failed OAuth exchanges to login without leaking provider errors", async () => {
    exchangeCodeForSession.mockResolvedValue({
      error: new Error("Unable to exchange code provider_token=secret"),
    });
    const request = new NextRequest(
      "http://localhost:3000/auth/confirm?code=bad-code&next=/onboarding",
    );

    const response = await GET(request);
    const location = new URL(response.headers.get("location") ?? "");

    expect(location.pathname).toBe("/login");
    expect(location.searchParams.get("error")).toBe("auth_link");
    expect(location.search).not.toMatch(/secret|provider_token/i);
  });
});
