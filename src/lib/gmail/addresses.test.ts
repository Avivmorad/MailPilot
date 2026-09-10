import { describe, expect, it } from "vitest";

import { classifyDirection, parseAddressList, parseEmailAddress } from "@/lib/gmail/addresses";

describe("parseEmailAddress", () => {
  it("parses display name and address", () => {
    expect(parseEmailAddress("Daniel <daniel@example.com>")).toEqual({
      email: "daniel@example.com",
      name: "Daniel",
    });
  });

  it("parses a bare address", () => {
    expect(parseEmailAddress("me@example.com")).toEqual({
      email: "me@example.com",
      name: null,
    });
  });
});

describe("parseAddressList", () => {
  it("splits multiple recipients", () => {
    const parsed = parseAddressList("Ada <ada@example.com>, bob@example.com");
    expect(parsed.map((item) => item.email)).toEqual(["ada@example.com", "bob@example.com"]);
  });
});

describe("classifyDirection", () => {
  const userEmails = ["me@example.com"];

  it("marks inbound mail", () => {
    expect(
      classifyDirection({
        from: parseEmailAddress("Ada <ada@example.com>"),
        to: parseAddressList("me@example.com"),
        cc: [],
        userEmails,
      }),
    ).toBe("INBOUND");
  });

  it("marks outbound mail", () => {
    expect(
      classifyDirection({
        from: parseEmailAddress("me@example.com"),
        to: parseAddressList("ada@example.com"),
        cc: [],
        userEmails,
      }),
    ).toBe("OUTBOUND");
  });

  it("marks self-sent mail", () => {
    expect(
      classifyDirection({
        from: parseEmailAddress("me@example.com"),
        to: parseAddressList("me@example.com"),
        cc: [],
        userEmails,
      }),
    ).toBe("SELF");
  });
});
