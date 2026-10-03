/** @vitest-environment jsdom */

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { DigestReportCard } from "@/components/digest/digest-report-card";
import type { DigestReport } from "@/lib/digest/types";

afterEach(() => {
  cleanup();
});

const digest: DigestReport = {
  id: "digest-1",
  userId: "user-1",
  connectionId: "connection-1",
  periodStart: "2026-09-10T00:00:00.000Z",
  periodEnd: "2026-09-10T12:00:00.000Z",
  totalMessages: 4,
  importantCount: 1,
  actionCount: 1,
  replyCount: 0,
  waitingCount: 0,
  informationalCount: 1,
  ignoredCount: 2,
  summaryText: "One payment still needs you.",
  topActions: [
    {
      threadId: "thread-pay",
      title: "אשר את החשבונית",
      urgency: null,
      deadline: null,
      category: "finance",
    },
  ],
  createdAt: "2026-09-10T12:00:00.000Z",
};

function expectCenteredOpen(href: string) {
  const open = screen.getByRole("link", { name: "Open" });
  expect(open).toHaveAttribute("href", href);
  const title = screen.getByRole("link", { name: "אשר את החשבונית" });
  const container = title.closest("[data-slot='mail-card-title']");
  expect(container).not.toBeNull();
  expect(container).toHaveClass("text-center");
  expect(container).toHaveClass("w-full");
  expect(title.closest("[dir='auto']")).not.toBeNull();
}

describe("DigestReportCard", () => {
  it("centers the title and renders Open on the dashboard preview", () => {
    render(<DigestReportCard digest={digest} variant="compact" />);
    expectCenteredOpen("/thread/thread-pay");
  });

  it("centers the title and renders Open on each history thread row", () => {
    render(<DigestReportCard digest={digest} />);
    expectCenteredOpen("/thread/thread-pay");
  });
});
