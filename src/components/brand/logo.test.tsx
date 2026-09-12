/** @vitest-environment jsdom */

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { Logo } from "@/components/brand/logo";

afterEach(() => {
  cleanup();
});

describe("Logo", () => {
  it("renders the wordmark by default", () => {
    render(<Logo />);

    expect(screen.getByText("MailPilot")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: /logo/i })).toBeInTheDocument();
  });

  it("can hide the wordmark", () => {
    render(<Logo showWordmark={false} />);

    expect(screen.queryByText("MailPilot")).not.toBeInTheDocument();
    expect(screen.getByRole("img", { name: /logo/i })).toBeInTheDocument();
  });
});
