/** @vitest-environment jsdom */

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { ThemeToggle } from "@/components/theme/theme-toggle";

afterEach(() => {
  cleanup();
  document.documentElement.classList.remove("dark");
});

describe("ThemeToggle", () => {
  it("announces light-mode as not pressed", () => {
    render(<ThemeToggle />);
    const button = screen.getByRole("button", { name: "Switch to dark mode" });
    expect(button).toHaveAttribute("aria-pressed", "false");
  });
});
