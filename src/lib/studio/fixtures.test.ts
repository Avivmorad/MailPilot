import { describe, expect, it } from "vitest";

import { countLane, STUDIO_ITEMS } from "@/lib/studio/fixtures";

describe("studio fixtures", () => {
  it("keeps open work separate from pending and FYI", () => {
    expect(countLane(STUDIO_ITEMS, "open")).toBe(3);
    expect(countLane(STUDIO_ITEMS, "pending")).toBe(2);
    expect(countLane(STUDIO_ITEMS, "fyi")).toBe(2);
    expect(STUDIO_ITEMS.find((item) => item.id === "stripe")?.lane).toBe("fyi");
  });
});
