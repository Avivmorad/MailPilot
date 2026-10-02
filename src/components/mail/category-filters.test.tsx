/** @vitest-environment jsdom */

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { MailCategoryFilters } from "@/components/mail/category-filters";

afterEach(() => {
  cleanup();
});

describe("MailCategoryFilters", () => {
  it("filters the current tab by label the same way a mail view is selected", () => {
    render(
      <MailCategoryFilters
        tab="waiting"
        total={4}
        active="finance"
        options={[
          { category: "finance", count: 2 },
          { category: "career", count: 1 },
        ]}
      />,
    );

    expect(screen.getByRole("link", { name: /All labels/ })).toHaveAttribute(
      "href",
      "/mail?tab=waiting",
    );
    const finance = screen.getByRole("link", { name: /Finance/ });
    expect(finance).toHaveAttribute("href", "/mail?tab=waiting");
    expect(finance).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: /Career/ })).toHaveAttribute(
      "href",
      "/mail?tab=waiting&category=career",
    );
  });

  it("shows a long label in full instead of a fixed truncated chip", () => {
    render(
      <MailCategoryFilters
        tab="open"
        total={1}
        active={null}
        options={[{ category: "official_legal", count: 1 }]}
      />,
    );

    const label = screen.getByRole("link", { name: /Official, Legal & Insurance/ });
    expect(label.className).not.toContain("truncate");
    expect(label.className).not.toContain("w-[7.25rem]");
    expect(label.className).toContain("w-max");
  });
});
