import { describe, expect, it } from "vitest";

import { TERMS_SECTIONS } from "@/lib/privacy/public-terms";

describe("public terms", () => {
  it("states no send/delete/archive and points users at Settings controls", () => {
    const text = TERMS_SECTIONS.map((section) => `${section.title} ${section.body}`).join(" ");
    expect(text).toMatch(/does not send, delete, or archive mail/i);
    expect(text).toMatch(/delete your GmailPilot account/i);
    expect(TERMS_SECTIONS.map((section) => section.id)).toEqual([
      "the-service",
      "your-account",
      "limitations",
      "google",
    ]);
  });
});
