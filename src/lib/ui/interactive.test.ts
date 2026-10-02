import { describe, expect, it } from "vitest";

import {
  interactiveCardClass,
  interactiveCardLinkClass,
  interactiveChipClass,
  interactiveControlClass,
  interactiveNavClass,
} from "@/lib/ui/interactive";

describe("interactive affordance classes", () => {
  it("keeps cursor and focus-ring cues alongside hover motion for a11y", () => {
    expect(interactiveControlClass).toContain("cursor-pointer");
    expect(interactiveControlClass).toContain("focus-visible:ring-3");
    expect(interactiveControlClass).toContain("ui-interactive");
  });

  it("puts hover motion on the card link control, not only the inner surface", () => {
    expect(interactiveCardLinkClass).toContain("ui-interactive");
    expect(interactiveCardLinkClass).toContain("cursor-pointer");
    expect(interactiveCardLinkClass).toContain("focus-visible:ring-3");
    expect(interactiveCardClass).toContain("cursor-pointer");
    expect(interactiveCardClass).not.toContain("ui-interactive");
  });

  it("exports chip and nav surfaces that share the hover utility", () => {
    for (const value of [interactiveChipClass, interactiveNavClass]) {
      expect(value).toContain("ui-interactive");
      expect(value).toContain("cursor-pointer");
      expect(value).not.toContain("box-shadow");
    }
  });

  it("does not reference glow shadow tokens", () => {
    for (const value of [
      interactiveControlClass,
      interactiveCardLinkClass,
      interactiveCardClass,
      interactiveChipClass,
      interactiveNavClass,
    ]) {
      expect(value).not.toMatch(/glow|shadow-\[/);
    }
  });
});
