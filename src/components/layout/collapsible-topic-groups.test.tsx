/** @vitest-environment jsdom */

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { CollapsibleTopicGroups } from "@/components/layout/collapsible-topic-groups";

afterEach(() => {
  cleanup();
});

describe("CollapsibleTopicGroups", () => {
  it("wraps a long topic name instead of truncating it", () => {
    render(
      <CollapsibleTopicGroups
        storageKey="topic-wrap"
        groups={[{ topic: "official_legal", count: 2, body: <p>Details</p> }]}
      />,
    );

    const heading = screen.getByRole("button", { name: /Official, Legal & Insurance/ });
    const title = heading.querySelector("span[dir='auto']");
    expect(title?.textContent).toBe("Official, Legal & Insurance");
    expect(title?.className).toContain("break-words");
    expect(title?.className).not.toContain("truncate");
  });
});
