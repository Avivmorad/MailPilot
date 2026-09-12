import { describe, expect, it } from "vitest";

import {
  gmailCallbackErrorRedirect,
  gmailStatusErrorMessage,
  toPublicConnection,
} from "@/lib/gmail/connections";

describe("toPublicConnection", () => {
  it("never includes the refresh token field", () => {
    const publicConnection = toPublicConnection({
      id: "conn-1",
      user_id: "user-1",
      gmail_email: "user@example.com",
      google_account_id: "123",
      encrypted_refresh_token: "v1:iv:tag:ciphertext",
      status: "CONNECTED",
      last_successful_scan_at: null,
      next_scan_at: null,
    });

    expect(publicConnection).toEqual({
      id: "conn-1",
      gmailEmail: "user@example.com",
      status: "CONNECTED",
      lastSuccessfulScanAt: null,
      nextScanAt: null,
    });
    expect(JSON.stringify(publicConnection)).not.toMatch(/token|v1:/i);
  });
});

describe("gmailStatusErrorMessage", () => {
  it("explains a missing table", () => {
    expect(
      gmailStatusErrorMessage({
        code: "PGRST205",
        message: "Could not find the table 'public.gmail_connections' in the schema cache",
      }),
    ).toMatch(/0002_gmail_connections/);
  });

  it("does not echo raw unknown database errors", () => {
    expect(gmailStatusErrorMessage({ code: "XX000", message: "internal boom" })).toBe(
      "Could not load Gmail connection status from the database.",
    );
  });
});

describe("gmailCallbackErrorRedirect", () => {
  it("returns the user to onboarding without leaking tokens", () => {
    const url = gmailCallbackErrorRedirect("https://mailpilot.example", "denied");
    expect(url.pathname).toBe("/onboarding");
    expect(url.searchParams.get("gmail")).toBe("error");
    expect(url.searchParams.get("reason")).toBe("denied");
    expect(url.toString()).not.toMatch(/token|code=/i);
  });
});
