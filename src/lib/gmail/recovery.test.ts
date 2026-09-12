import { describe, expect, it } from "vitest";

import { gmailRecoveryActionLabel, shouldShowGmailRecoveryCard } from "@/lib/gmail/recovery";

const connected = {
  configured: true,
  loadError: null,
  connection: {
    id: "c1",
    gmailEmail: "user@example.com",
    status: "CONNECTED" as const,
    lastSuccessfulScanAt: null,
    nextScanAt: null,
  },
};

describe("shouldShowGmailRecoveryCard", () => {
  it("hides the card when Gmail is connected", () => {
    expect(shouldShowGmailRecoveryCard(connected)).toBe(false);
  });

  it("shows recovery for missing config, load errors, and non-connected statuses", () => {
    expect(shouldShowGmailRecoveryCard({ configured: false, loadError: null, connection: null })).toBe(true);
    expect(
      shouldShowGmailRecoveryCard({
        configured: true,
        loadError: "Apply supabase/migrations/0002_gmail_connections.sql in the Supabase SQL Editor, then reload.",
        connection: null,
      }),
    ).toBe(true);
    expect(shouldShowGmailRecoveryCard({ configured: true, loadError: null, connection: null })).toBe(true);
    expect(
      shouldShowGmailRecoveryCard({
        ...connected,
        connection: { ...connected.connection, status: "REAUTH_REQUIRED" },
      }),
    ).toBe(true);
    expect(
      shouldShowGmailRecoveryCard({
        ...connected,
        connection: { ...connected.connection, status: "DISCONNECTED" },
      }),
    ).toBe(true);
    expect(
      shouldShowGmailRecoveryCard({
        ...connected,
        connection: { ...connected.connection, status: "ERROR" },
      }),
    ).toBe(true);
  });
});

describe("gmailRecoveryActionLabel", () => {
  it("asks to reconnect when the connection expired or errored", () => {
    expect(
      gmailRecoveryActionLabel({
        ...connected,
        connection: { ...connected.connection, status: "REAUTH_REQUIRED" },
      }),
    ).toBe("Reconnect Gmail");
    expect(
      gmailRecoveryActionLabel({
        ...connected,
        connection: { ...connected.connection, status: "ERROR" },
      }),
    ).toBe("Reconnect Gmail");
    expect(gmailRecoveryActionLabel({ configured: true, loadError: null, connection: null })).toBe("Connect Gmail");
  });
});
