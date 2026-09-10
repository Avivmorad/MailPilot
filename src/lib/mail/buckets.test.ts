import { describe, expect, it } from "vitest";

import { assertExclusiveMailBuckets, mailBucketForThread, normalizeThreadStatus } from "@/lib/mail/buckets";

describe("normalizeThreadStatus", () => {
  it("never returns an empty status", () => {
    expect(normalizeThreadStatus(null)).toBe("informational");
    expect(normalizeThreadStatus("")).toBe("informational");
    expect(normalizeThreadStatus("ignore")).toBe("ignore");
  });
});

describe("mailBucketForThread", () => {
  it("maps one canonical status to exactly one tab", () => {
    expect(mailBucketForThread({ status: "informational" })).toBe("summary");
    expect(mailBucketForThread({ status: "ignore" })).toBe("ignored");
    expect(mailBucketForThread({ status: "action_required" })).toBe("open");
    expect(mailBucketForThread({ status: "action_required", actionStatus: "SNOOZED" })).toBe("snoozed");
    expect(mailBucketForThread({ status: null })).toBe("summary");
  });
});

describe("assertExclusiveMailBuckets", () => {
  it("rejects the same thread in Summary and Ignored", () => {
    expect(() =>
      assertExclusiveMailBuckets([
        { id: "t1", bucket: "summary" },
        { id: "t1", bucket: "ignored" },
      ]),
    ).toThrow(/t1/);
  });

  it("allows one thread in one group", () => {
    expect(() =>
      assertExclusiveMailBuckets([
        { id: "t1", bucket: "summary" },
        { id: "t2", bucket: "ignored" },
      ]),
    ).not.toThrow();
  });
});
