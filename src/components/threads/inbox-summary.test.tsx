/** @vitest-environment jsdom */

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

import { InboxSummary } from "@/components/threads/inbox-summary";

afterEach(() => {
  cleanup();
});

describe("InboxSummary", () => {
  it("explains why a summary thread is in that tab and offers a correction", () => {
    render(
      <InboxSummary
        threads={[
          {
            id: "thread-1",
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

    expect(screen.getByText(/leftover FYI/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Needs action" })).toBeInTheDocument();
  });
});
