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
});
