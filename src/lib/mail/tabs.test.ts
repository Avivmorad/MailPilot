import { describe, expect, it } from "vitest";

import {
  actionStatusForMailTab,
  isMailTab,
  mailTabFromLegacyActionTab,
  parseMailTab,
} from "@/lib/mail/tabs";

describe("mail tabs", () => {
  it("parses known tabs and defaults unknown values to summary", () => {
    expect(parseMailTab("open")).toBe("open");
    expect(parseMailTab("ignored")).toBe("ignored");
    expect(parseMailTab("OPEN")).toBe("summary");
    expect(parseMailTab(undefined)).toBe("summary");
    expect(isMailTab("waiting")).toBe(true);
    expect(isMailTab("nope")).toBe(false);
  });

  it("maps action tabs and leaves digest/ignore as non-actions", () => {
    expect(actionStatusForMailTab("open")).toBe("OPEN");
    expect(actionStatusForMailTab("completed")).toBe("COMPLETED");
    expect(actionStatusForMailTab("summary")).toBeNull();
    expect(actionStatusForMailTab("ignored")).toBeNull();
  });

  it("maps legacy Action Center query params", () => {
    expect(mailTabFromLegacyActionTab("OPEN")).toBe("open");
    expect(mailTabFromLegacyActionTab("SNOOZED")).toBe("snoozed");
    expect(mailTabFromLegacyActionTab("summary")).toBe("summary");
  });
});
