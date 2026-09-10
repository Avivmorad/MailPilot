import { describe, expect, it } from "vitest";

import { toPublicConnection } from "@/lib/gmail/connections";

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
