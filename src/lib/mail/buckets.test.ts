import { describe, expect, it } from "vitest";

import {
  assertExclusiveMailBuckets,
  isClassifiedSummaryThread,
  mailBucketForThread,
  normalizeThreadStatus,
} from "@/lib/mail/buckets";

describe("normalizeThreadStatus", () => {
  it("never returns an empty status", () => {
    expect(normalizeThreadStatus(null)).toBe("informational");
    expect(normalizeThreadStatus("")).toBe("informational");
    expect(normalizeThreadStatus("ignore")).toBe("ignore");
  });
});

describe("isClassifiedSummaryThread", () => {
  it("hides threads saved when classification never ran", () => {
    expect(isClassifiedSummaryThread({ status: "informational", summary: null })).toBe(false);
    expect(isClassifiedSummaryThread({ status: "informational", summary: "  " })).toBe(false);
    expect(isClassifiedSummaryThread({ status: null, summary: null })).toBe(false);
    expect(
      isClassifiedSummaryThread({ status: "informational", summary: "A useful update." }),
    ).toBe(true);
  });
});

describe("mailBucketForThread", () => {
  it("maps one canonical status to exactly one tab", () => {
    expect(mailBucketForThread({ status: "informational" })).toBe("summary");
    expect(mailBucketForThread({ status: "ignore" })).toBe("ignored");
    expect(mailBucketForThread({ status: "action_required" })).toBe("open");
    expect(mailBucketForThread({ status: "action_required", actionStatus: "SNOOZED" })).toBe(
      "snoozed",
    );
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
