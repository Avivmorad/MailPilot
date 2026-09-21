import { describe, expect, it } from "vitest";

import {
  formatThreadFailureMessage,
  mergePendingFailedThreadIds,
  parseThreadFailureIds,
} from "@/lib/scans/thread-failures";

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

  it("merges failed thread ids across multiple partial scans", () => {
    const merged = mergePendingFailedThreadIds([
      {
        failedThreadIds: ["t-new"],
        errorMessage: formatThreadFailureMessage(["t-new"]),
      },
      {
        failedThreadIds: ["t-old"],
        errorMessage: formatThreadFailureMessage(["t-old"]),
      },
    ]);
    expect(merged).toEqual(["t-new", "t-old"]);
  });
});
