import { describe, expect, it } from "vitest";

import { GMAIL_MODIFY_SCOPE, PRIVACY_POLICY_SECTIONS } from "@/lib/privacy/public-policy";

describe("public privacy policy", () => {
  it("states the Gmail scope, no long-term bodies, and no sending mail", () => {
    const text = PRIVACY_POLICY_SECTIONS.map((section) => `${section.title} ${section.body}`).join(
      " ",
    );
    expect(text).toContain(GMAIL_MODIFY_SCOPE);
    expect(text).toMatch(/does not persist full email bodies/i);
    expect(text).toMatch(/does not send, delete, or archive mail/i);
    expect(text).toMatch(/encrypted at rest/i);
    expect(text).toMatch(/Limited Use of Gmail data/i);
    expect(text).toMatch(/does not sell Gmail data/i);
    expect(PRIVACY_POLICY_SECTIONS.map((section) => section.id)).toEqual([
      "what-mailpilot-is",
      "gmail-access",
      "what-we-store",
      "your-controls",
      "limited-use",
      "google",
    ]);
  });
});
