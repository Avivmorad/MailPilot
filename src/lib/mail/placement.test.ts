import { describe, expect, it } from "vitest";

import {
  PLACEMENT_CORRECTIONS,
  sanitizePlacementEvidence,
  threadPlacementReason,
} from "@/lib/mail/placement";

describe("threadPlacementReason", () => {
  it("explains each Mail tab without requiring model reasoning", () => {
    expect(threadPlacementReason({ tab: "open" })).toContain("Open");
    expect(threadPlacementReason({ tab: "summary" })).toContain("FYI");
    expect(threadPlacementReason({ tab: "ignored" })).toContain("Ignored");
    expect(threadPlacementReason({ tab: "waiting" })).toContain("already acted");
  });

  it("appends short evidence and redacts email addresses", () => {
    expect(
      threadPlacementReason({
        tab: "open",
        evidence: "Pay the remaining balance sent to ada@example.com before Friday.",
      }),
    ).toBe(
      "This is in Open because it still needs a next step from you. Pay the remaining balance sent to [email] before Friday.",
    );
    expect(sanitizePlacementEvidence("a".repeat(200))?.endsWith("…")).toBe(true);
  });

  it("offers one-click corrections that move the thread", () => {
    expect(PLACEMENT_CORRECTIONS.open).toEqual(["no_action", "waiting"]);
    expect(PLACEMENT_CORRECTIONS.summary).toEqual(["action"]);
    expect(PLACEMENT_CORRECTIONS.ignored).toEqual(["action"]);
  });
});
