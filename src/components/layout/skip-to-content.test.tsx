/** @vitest-environment jsdom */

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { SkipToContent } from "@/components/layout/skip-to-content";

afterEach(() => {
  cleanup();
});

describe("SkipToContent", () => {
  it("points keyboard users at the main landmark", () => {
    render(<SkipToContent />);
    const link = screen.getByRole("link", { name: "Skip to content" });
    expect(link).toHaveAttribute("href", "#main-content");
  });
});
