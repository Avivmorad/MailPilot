/** @vitest-environment jsdom */

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { EmptyState } from "@/components/layout/empty-state";

afterEach(() => {
  cleanup();
});

describe("EmptyState", () => {
  it("renders default variant with status role", () => {
    render(<EmptyState title="No mail" description="You have no mail." />);
    const region = screen.getByRole("status");
    expect(region).toBeInTheDocument();
    expect(screen.getByText("No mail")).toBeInTheDocument();
    expect(screen.getByText("You have no mail.")).toBeInTheDocument();
  });

  it("renders error variant with alert role and destructive styling", () => {
    render(
      <EmptyState
        variant="error"
        title="Could not load tasks"
        description="Database failed."
        action={<button type="button">Retry</button>}
      />,
    );
    const alert = screen.getByRole("alert");
    expect(alert).toBeInTheDocument();
    expect(screen.getByText("Could not load tasks")).toHaveClass("text-destructive");
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
  });
});
