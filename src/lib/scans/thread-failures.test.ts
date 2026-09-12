import { describe, expect, it } from "vitest";

import { formatThreadFailureMessage, parseThreadFailureIds } from "@/lib/scans/thread-failures";

describe("thread failure records", () => {
  it("round-trips recorded Gmail thread ids", () => {
    const message = formatThreadFailureMessage(["t1", "t1", "t2"]);
    expect(message).toBe("thread_failures:3:t1,t2");
    expect(parseThreadFailureIds(message)).toEqual(["t1", "t2"]);
  });

  it("ignores other error messages and invalid ids", () => {
    expect(parseThreadFailureIds("reauth_required")).toEqual([]);
    expect(parseThreadFailureIds("thread_failures:1:bad id")).toEqual([]);
  });
});
