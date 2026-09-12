import { describe, expect, it } from "vitest";

import { gmailSearchFallbackUrl, gmailThreadUrl } from "@/lib/gmail/deep-link";

describe("gmailThreadUrl", () => {
  it("builds an authuser all-mail thread link", () => {
    expect(gmailThreadUrl("user@example.com", "thread-abc")).toBe(
      "https://mail.google.com/mail/?authuser=user%40example.com#all/thread-abc",
    );
  });

  it("falls back to Gmail home when identifiers are missing", () => {
    expect(gmailThreadUrl("", "")).toBe("https://mail.google.com/mail/");
  });
});

describe("gmailSearchFallbackUrl", () => {
  it("builds a subject search link", () => {
    expect(gmailSearchFallbackUrl("user@example.com", "Invoice")).toContain(
      "authuser=user%40example.com",
    );
    expect(gmailSearchFallbackUrl("user@example.com", "Invoice")).toContain("q=subject%3AInvoice");
  });
});
