import { describe, expect, it } from "vitest";

import {
  PLACEMENT_CORRECTIONS,
  sanitizePlacementEvidence,
  threadPlacementReason,
} from "@/lib/mail/placement";

const OLD_FOR_YOU = "This is in For You because it is a useful update, not an action.";
const OLD_ACTIONS = "This is in Actions because it still needs a next step from you.";
const OLD_IGNORED = "This is in Ignored because it is noise or a notice, not a task.";

function expectShortReason(reason: string) {
  expect(reason.length).toBeGreaterThan(0);
  expect(reason.length).toBeLessThanOrEqual(110);
  expect(reason).not.toContain("\n");
  expect(reason).not.toBe(OLD_FOR_YOU);
  expect(reason).not.toBe(OLD_ACTIONS);
  expect(reason).not.toBe(OLD_IGNORED);
  expect(reason.toLowerCase()).not.toContain("useful update, not an action");
  expect(reason.toLowerCase()).not.toContain("still needs a next step from you");
  expect(reason.toLowerCase()).not.toContain("noise or a notice, not a task");
}

describe("threadPlacementReason", () => {
  it("shows a trimmed model reason instead of a tab slogan", () => {
    expect(
      threadPlacementReason({
        tab: "summary",
        category: "newsletters_promotions",
        importanceReason: "Lab results are ready in the portal.",
        summary: "A portal message arrived.",
      }),
    ).toBe("Lab results are ready in the portal.");

    expect(
      threadPlacementReason({
        tab: "open",
        evidence: "Pay the remaining balance sent to ada@example.com before Friday.",
      }),
    ).toBe("Pay the remaining balance sent to [email] before Friday.");

    expect(
      threadPlacementReason({
        tab: "ignored",
        importanceReason: "One-time login code.",
        category: "security",
      }),
    ).toBe("One-time login code.");
  });

  it("keeps For You, Actions, and Ignored reasons short and specific", () => {
    const newsletter = threadPlacementReason({
      tab: "summary",
      category: "newsletters_promotions",
      sender: "Morning Brew",
    });
    const flight = threadPlacementReason({
      tab: "summary",
      category: "travel_transport",
      summary: "The 9am flight moved to 11am.",
      title: "Flight change",
    });
    const reply = threadPlacementReason({
      tab: "open",
      requiresReply: true,
      category: "career",
    });
    const payment = threadPlacementReason({
      tab: "open",
      actionType: "pay",
      deadline: "2026-10-03",
      category: "finance",
    });
    const receipt = threadPlacementReason({
      tab: "ignored",
      category: "finance",
      sender: "Bank",
    });
    const promo = threadPlacementReason({
      tab: "ignored",
      category: "newsletters_promotions",
    });

    for (const reason of [newsletter, flight, reply, payment, receipt, promo]) {
      expectShortReason(reason);
    }

    expect(newsletter).toBe("Newsletter update from Morning Brew, nothing to do.");
    expect(flight).toBe("Travel update, nothing to do.");
    expect(newsletter).not.toBe(flight);
    expect(reply).toBe("Reply needed.");
    expect(payment).toBe("Payment needed, due 3 Oct.");
    expect(reply).not.toBe(payment);
    expect(receipt).toBe("Finance notice from Bank.");
    expect(promo).toBe("Newsletter notice.");
    expect(receipt).not.toBe(promo);
  });

  it("does not reuse one filler line when the model reason is missing", () => {
    const bareForYou = threadPlacementReason({ tab: "summary" });
    const withSummary = threadPlacementReason({
      tab: "summary",
      summary: "Boarding pass is ready.",
      title: "Trip",
    });
    expectShortReason(bareForYou);
    expectShortReason(withSummary);
    expect(bareForYou).not.toBe(withSummary);
    expect(bareForYou).not.toBe(OLD_FOR_YOU);

    const security = threadPlacementReason({ tab: "ignored", category: "security" });
    const career = threadPlacementReason({ tab: "ignored", category: "career" });
    expect(security).not.toBe(career);
    expect(security).not.toBe(OLD_IGNORED);
  });

  it("skips generic model fillers and derives from the classification", () => {
    expect(
      threadPlacementReason({
        tab: "summary",
        category: "travel_transport",
        importanceReason: "Needs a quick look",
        summary: "Boarding pass is ready.",
        title: "Flight",
      }),
    ).toBe("Travel update, nothing to do.");

    expect(
      threadPlacementReason({
        tab: "waiting",
        waitingFor: "the registrar",
      }),
    ).toBe("Waiting on the registrar.");

    expect(threadPlacementReason({ tab: "waiting" })).toBe("You already did your part.");
    expect(threadPlacementReason({ tab: "completed" })).toBe("Marked closed.");
    expect(threadPlacementReason({ tab: "snoozed", snoozedUntil: "2026-10-09" })).toBe(
      "Snoozed until 9 Oct.",
    );
  });

  it("redacts email addresses and caps long evidence", () => {
    expect(sanitizePlacementEvidence("a".repeat(200))?.endsWith("…")).toBe(true);
    expect(sanitizePlacementEvidence("a".repeat(200))!.length).toBeLessThanOrEqual(110);
  });

  it("offers one-click corrections that move the thread", () => {
    expect(PLACEMENT_CORRECTIONS.open).toEqual(["no_action", "waiting"]);
    expect(PLACEMENT_CORRECTIONS.summary).toEqual(["action"]);
    expect(PLACEMENT_CORRECTIONS.ignored).toEqual(["action"]);
  });
});
