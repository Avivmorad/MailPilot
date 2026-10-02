import { describe, expect, it } from "vitest";

import { TERMS_SECTIONS } from "@/lib/privacy/public-terms";

describe("public terms", () => {
  it("states no send/delete/archive and points users at Settings controls", () => {
    const text = TERMS_SECTIONS.map((section) => `${section.title} ${section.body}`).join(" ");
    expect(text).toMatch(/does not send, delete, or archive mail/i);
    expect(text).toMatch(/delete your MailPriority account/i);
    expect(text).toMatch(/does not publish a support email address/);
    expect(text).toMatch(/best-effort once a day/);
    expect(text).toMatch(/06:00 UTC/);
    expect(text).toMatch(/not a promise that MailPriority will run at that local time/);
    expect(text).toMatch(/Scan now still runs when you start it/);
    expect(text).toMatch(/NVIDIA Build when an NVIDIA API key is configured/);
    expect(text).toMatch(/otherwise to Google Gemini/);
    expect(text).not.toMatch(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
    expect(TERMS_SECTIONS.map((section) => section.id)).toEqual([
      "the-service",
      "your-account",
      "limitations",
      "processors",
      "google",
    ]);
  });
});
