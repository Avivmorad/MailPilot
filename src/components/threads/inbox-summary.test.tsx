/** @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

import { InboxSummary } from "@/components/threads/inbox-summary";

afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

function expandCategory(name: RegExp) {
  const header = screen.getByRole("button", { name });
  fireEvent.click(header);
}

describe("InboxSummary", () => {
  it("explains why a summary thread is in that tab and offers a correction", () => {
    render(
      <InboxSummary
        threads={[
          {
            id: "thread-1",
            subject: "Your flight changed",
            shortDisplayTitle: "Flight change",
            summary: "The 9am flight moved to 11am.",
            status: "informational",
            importance: "medium",
            category: "travel_transport",
            latestMessageAt: "2026-09-10T10:00:00.000Z",
          },
        ]}
      />,
    );

    expandCategory(/Travel & Transport/);
    expect(screen.getByText(/useful update/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Actions" })).toBeInTheDocument();
  });

  it("uses the mailbox subject when the model did not return a title", () => {
    render(
      <InboxSummary
        threads={[
          {
            id: "thread-2",
            subject: "Invoice 1042",
            shortDisplayTitle: null,
            summary: null,
            status: "informational",
            importance: null,
            category: null,
            latestMessageAt: "2026-09-10T10:00:00.000Z",
          },
        ]}
      />,
    );

    expandCategory(/Other/);
    expect(screen.getByText("Invoice 1042")).toBeInTheDocument();
    expect(screen.queryByText("Thread")).not.toBeInTheDocument();
  });

  it("does not render the literal string null as a primary title", () => {
    render(
      <InboxSummary
        threads={[
          {
            id: "thread-3",
            subject: "Board packet",
            shortDisplayTitle: "null",
            summary: "undefined",
            status: "informational",
            importance: "low",
            category: "other",
            latestMessageAt: "2026-09-10T10:00:00.000Z",
          },
        ]}
      />,
    );

    expandCategory(/Other/);
    expect(screen.getByText("Board packet")).toBeInTheDocument();
    expect(screen.queryByText(/^null$/i)).not.toBeInTheDocument();
  });
});
