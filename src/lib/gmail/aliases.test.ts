import { describe, expect, it } from "vitest";

import { classifyDirection, parseAddressList, parseEmailAddress } from "@/lib/gmail/addresses";
import { mergeUserEmails, safeListSendAsEmails, sendAsEmailsFromList } from "@/lib/gmail/aliases";

describe("mergeUserEmails", () => {
  it("dedupes, normalizes, and drops invalid values", () => {
    expect(
      mergeUserEmails(["Me@Example.com"], ["alias@example.com", "me@example.com", "not-an-email"]),
    ).toEqual(["me@example.com", "alias@example.com"]);
  });

  it("caps the recognized address list", () => {
    const extras = Array.from({ length: 40 }, (_, index) => `a${index}@example.com`);
    expect(mergeUserEmails(["me@example.com"], extras)).toHaveLength(25);
  });
});

describe("sendAsEmailsFromList", () => {
  it("reads sendAsEmail values only", () => {
    expect(
      sendAsEmailsFromList({
        sendAs: [
          { sendAsEmail: "me@example.com", isPrimary: true },
          { sendAsEmail: "work@company.com" },
          { displayName: "No address" },
        ],
      }),
    ).toEqual(["me@example.com", "work@company.com"]);
  });
});

describe("safeListSendAsEmails", () => {
  it("falls back to an empty list when Gmail settings fail", async () => {
    expect(await safeListSendAsEmails(undefined)).toEqual([]);
    expect(
      await safeListSendAsEmails(async () => {
        throw new Error("settings.sendAs denied");
      }),
    ).toEqual([]);
  });
});

describe("classifyDirection with aliases", () => {
  it("treats sendAs aliases as the user", () => {
    const userEmails = mergeUserEmails(["me@example.com"], ["alias@example.com"]);
    expect(
      classifyDirection({
        from: parseEmailAddress("alias@example.com"),
        to: parseAddressList("ada@example.com"),
        cc: [],
        userEmails,
      }),
    ).toBe("OUTBOUND");
    expect(
      classifyDirection({
        from: parseEmailAddress("ada@example.com"),
        to: parseAddressList("alias@example.com"),
        cc: [],
        userEmails,
      }),
    ).toBe("INBOUND");
  });
});
