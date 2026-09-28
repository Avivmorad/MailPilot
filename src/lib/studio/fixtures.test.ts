import { describe, expect, it } from "vitest";

import { countLane, resolveVisibleSelection, STUDIO_ITEMS } from "@/lib/studio/fixtures";

describe("studio fixtures", () => {
  it("keeps open work separate from pending and FYI", () => {
    expect(countLane(STUDIO_ITEMS, "open")).toBe(3);
    expect(countLane(STUDIO_ITEMS, "pending")).toBe(2);
    expect(countLane(STUDIO_ITEMS, "fyi")).toBe(2);
    expect(STUDIO_ITEMS.find((item) => item.id === "stripe")?.lane).toBe("fyi");
  });

  it("keeps the reading pane inside the visible lane", () => {
    const open = STUDIO_ITEMS.filter((item) => item.lane === "open");
    const fyi = STUDIO_ITEMS.filter((item) => item.lane === "fyi");
    expect(resolveVisibleSelection(open, "reg")?.id).toBe("reg");
    expect(resolveVisibleSelection(fyi, "reg")?.id).toBe(fyi[0]?.id);
    expect(resolveVisibleSelection([], "reg")).toBeUndefined();
  });
});
