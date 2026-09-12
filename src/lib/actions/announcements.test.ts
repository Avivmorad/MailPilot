import { describe, expect, it } from "vitest";

import { actionChangeAnnouncement } from "@/lib/actions/announcements";

describe("actionChangeAnnouncement", () => {
  it("names the workflow change for screen readers", () => {
    expect(actionChangeAnnouncement("complete")).toBe("Task marked done.");
    expect(actionChangeAnnouncement("reopen")).toBe("Task moved back to Open.");
    expect(actionChangeAnnouncement("snooze")).toBe("Task snoozed.");
    expect(actionChangeAnnouncement("wait")).toBe("Waiting on updated.");
    expect(actionChangeAnnouncement("unknown")).toBe("Task updated.");
  });
});
