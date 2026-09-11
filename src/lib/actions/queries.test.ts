import { describe, expect, it } from "vitest";

import { mapActionListItem } from "@/lib/actions/queries";

const THREAD = {
  id: "thread-1",
  summary: "Registration is open.",
  importance: "high",
  latest_message_at: "2026-09-10T08:00:00.000Z",
  gmail_thread_id: "gmail-1",
  participants: [{ name: "Registrar", email: "office@uni.example" }],
  category: "education",
  short_display_title: "University registration",
  action_summary: "Choose courses and submit registration.",
  action_reason: "Registration closes after the deadline.",
};

describe("mapActionListItem", () => {
  it("maps thread action_summary to Do and action_reason to Why", () => {
    const item = mapActionListItem(
      {
        id: "action-1",
        thread_id: "thread-1",
        status: "OPEN",
        title: "University registration",
        description: "Choose courses and submit registration.",
        waiting_for: null,
        deadline: "2026-09-12",
        urgency: "soon",
        action_type: "submit",
        email_threads: THREAD,
      },
      "me@gmail.com",
    );

    expect(item.actionSummary).toBe("Choose courses and submit registration.");
    expect(item.actionReason).toBe("Registration closes after the deadline.");
    expect(item.title).toBe("University registration");
    expect(item.sender).toBe("Registrar");
    expect(item.gmailUrl).toContain("gmail-1");
  });

  it("falls back to action description when the thread has no action_summary", () => {
    const item = mapActionListItem(
      {
        id: "action-2",
        thread_id: "thread-1",
        status: "OPEN",
        title: "Pay invoice",
        description: "Pay the remaining balance.",
        waiting_for: null,
        deadline: null,
        urgency: null,
        action_type: "pay",
        email_threads: { ...THREAD, action_summary: null, action_reason: null },
      },
      "me@gmail.com",
    );

    expect(item.actionSummary).toBe("Pay the remaining balance.");
    expect(item.actionReason).toBeNull();
  });
});
