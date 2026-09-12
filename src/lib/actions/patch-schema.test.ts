import { describe, expect, it } from "vitest";

import { actionPatchSchema } from "@/lib/actions/patch-schema";

describe("actionPatchSchema", () => {
  it("rejects calendar dates that do not exist", () => {
    expect(actionPatchSchema.safeParse({ op: "snooze", until: "2026-09-31" }).success).toBe(false);
    expect(actionPatchSchema.safeParse({ op: "snooze", until: "2026-09-18" }).success).toBe(true);
  });
});
