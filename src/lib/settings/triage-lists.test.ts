import { describe, expect, it } from "vitest";

import { parseTriageDomain, parseTriageSender } from "@/lib/settings/triage-lists";

describe("parseTriageSender", () => {
  it("normalizes valid emails and rejects invalid ones", () => {
    expect(parseTriageSender("  Ada@Example.com ")).toEqual({
      ok: true,
      value: "ada@example.com",
    });
    expect(parseTriageSender("not-an-email").ok).toBe(false);
    expect(parseTriageSender("").ok).toBe(false);
  });
});

describe("parseTriageDomain", () => {
  it("normalizes domains and rejects host fragments", () => {
    expect(parseTriageDomain("@News.Example.com")).toEqual({
      ok: true,
      value: "news.example.com",
    });
    expect(parseTriageDomain("not a domain").ok).toBe(false);
    expect(parseTriageDomain("localhost").ok).toBe(false);
  });
});
