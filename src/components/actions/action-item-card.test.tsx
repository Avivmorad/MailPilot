/** @vitest-environment jsdom */

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

import { ActionItemCard } from "@/components/actions/action-item-card";
import type { ActionListItem } from "@/lib/actions/action-list-item";

afterEach(() => {
  cleanup();
});

const item: ActionListItem = {
  id: "action-1",
  threadId: "thread-he",
  status: "OPEN",
  title: "החשבוניות העדכניות שלך",
  description: null,
  actionSummary: "Download the latest invoices.",
  actionReason: null,
  waitingFor: null,
  snoozedUntil: null,
  deadline: null,
  urgency: null,
  latestMessageAt: "2026-09-10T10:00:00.000Z",
  importance: "medium",
  summary: "Your latest invoices are ready.",
  sender: "Billing",
  gmailUrl: "https://mail.google.com/mail/u/0/#inbox/abc",
  category: "finance",
  actionType: null,
  confidence: 0.9,
  updatedAt: "2026-09-10T10:00:00.000Z",
};

describe("ActionItemCard", () => {
  it("renders Open and centers the short display title", () => {
    render(<ActionItemCard item={item} />);

    const open = screen.getByRole("link", { name: "Open" });
    expect(open).toHaveAttribute("href", "/thread/thread-he");
    const title = screen.getByRole("link", { name: "החשבוניות העדכניות שלך" });
    const container = title.closest("[data-slot='mail-card-title']");
    expect(container).not.toBeNull();
    expect(container).toHaveClass("text-center");
    expect(container).toHaveClass("w-full");
    expect(title.closest("[dir='auto']")).not.toBeNull();
  });
});
