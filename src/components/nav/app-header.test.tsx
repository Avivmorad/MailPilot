/** @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { AppHeader } from "@/components/nav/app-header";
import { SIDEBAR_STORAGE_KEY } from "@/lib/ui/sidebar";

afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

describe("AppHeader", () => {
  it("marks the current section and exposes a labeled landmark", () => {
    render(<AppHeader email="user@example.com" current="mail" />);

    expect(screen.getByRole("navigation", { name: "Main" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "MailPriority home" })).toHaveAttribute(
      "href",
      "/dashboard",
    );
    expect(screen.getByRole("link", { name: "Scan" })).toHaveAttribute("href", "/scan");
    expect(screen.getByRole("link", { name: "History" })).toHaveAttribute("href", "/history");
    expect(screen.getByRole("link", { name: "Mail" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Dashboard" })).not.toHaveAttribute("aria-current");
  });

  it("toggles the desktop sidebar collapse preference in localStorage", () => {
    render(<AppHeader email="user@example.com" current="dashboard" />);

    const collapse = screen.getByRole("button", { name: "Collapse sidebar" });
    expect(collapse).toHaveAttribute("aria-expanded", "true");
    expect(window.localStorage.getItem(SIDEBAR_STORAGE_KEY)).toBeNull();

    fireEvent.click(collapse);

    expect(window.localStorage.getItem(SIDEBAR_STORAGE_KEY)).toBe("1");
    expect(screen.getByRole("button", { name: "Expand sidebar" })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
    expect(screen.getByRole("navigation", { name: "Main" })).toHaveAttribute(
      "id",
      "app-sidebar-nav",
    );

    fireEvent.click(screen.getByRole("button", { name: "Expand sidebar" }));

    expect(window.localStorage.getItem(SIDEBAR_STORAGE_KEY)).toBe("0");
    expect(screen.getByRole("button", { name: "Collapse sidebar" })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
  });

  it("restores a collapsed preference from localStorage", () => {
    window.localStorage.setItem(SIDEBAR_STORAGE_KEY, "1");
    render(<AppHeader email="user@example.com" current="settings" />);

    expect(screen.getByRole("button", { name: "Expand sidebar" })).toBeInTheDocument();
    expect(screen.queryByText("user@example.com")).not.toBeInTheDocument();
    const nav = screen.getByRole("navigation", { name: "Main" });
    expect(within(nav).getByText("Settings").className).toMatch(/lg:sr-only/);
  });
});
