import { describe, expect, it } from "vitest";

import {
  humanizeToken,
  labelForDirection,
  labelForScanStatus,
  labelForThreadStatus,
} from "@/lib/ui/labels";

describe("humanizeToken", () => {
  it("maps known product tokens to readable copy", () => {
    expect(labelForThreadStatus("action_required")).toBe("Needs action");
    expect(labelForScanStatus("RUNNING")).toBe("In progress");
    expect(labelForDirection("INBOUND")).toBe("Received");
    expect(labelForDirection("OUTBOUND")).toBe("Sent by you");
  });

  it("title-cases unknown snake_case values", () => {
    expect(humanizeToken("needs_review")).toBe("Needs review");
    expect(humanizeToken("expired")).toBe("Expired");
    expect(humanizeToken("later")).toBe("Later");
    expect(humanizeToken("projects_development")).toBe("Projects & Development");
  });

  it("returns empty string for missing values", () => {
    expect(humanizeToken(null)).toBe("");
  });
});
