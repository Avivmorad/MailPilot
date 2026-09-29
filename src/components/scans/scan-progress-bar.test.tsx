/** @vitest-environment jsdom */

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { ScanProgressBar } from "@/components/scans/scan-progress-bar";

afterEach(() => {
  cleanup();
});

describe("ScanProgressBar", () => {
  it("keeps a running discovery state indeterminate", () => {
    render(<ScanProgressBar threadsChecked={0} threadsDiscovered={0} status="RUNNING" />);
    const bar = screen.getByRole("progressbar", { name: "Scan progress" });
    expect(bar).not.toHaveAttribute("aria-valuenow");
    expect(bar).toHaveAttribute("aria-valuetext", "Discovering conversations in Gmail…");
    expect(screen.getByText("Discovering conversations in Gmail…")).toHaveAttribute(
      "aria-live",
      "polite",
    );
    expect(bar.querySelector(".motion-reduce\\:animate-none")).toBeTruthy();
  });

  it("reports an empty success as complete and determinate", () => {
    render(<ScanProgressBar threadsChecked={0} threadsDiscovered={0} status="SUCCESS" />);
    const bar = screen.getByRole("progressbar", { name: "Scan progress" });
    expect(bar).toHaveAttribute("aria-valuenow", "100");
    expect(bar).toHaveAttribute("aria-valuetext", "No conversations in this window.");
    expect(screen.getByText("100%")).toBeInTheDocument();
    expect(bar.querySelector(".motion-reduce\\:transition-none")).toBeTruthy();
  });

  it("does not claim retries were queued for a partial scan", () => {
    render(
      <ScanProgressBar
        threadsChecked={2}
        threadsDiscovered={4}
        status="PARTIAL"
        errorCode="partial_thread_failures"
      />,
    );
    const bar = screen.getByRole("progressbar", { name: "Scan progress" });
    expect(bar.getAttribute("aria-valuetext") ?? "").not.toMatch(/retries queued/i);
    expect(screen.queryByText(/Retries queued/)).not.toBeInTheDocument();
    expect(screen.getByText(/Some could not be processed/)).toBeInTheDocument();
  });

  it("keeps a zero-thread failure determinate", () => {
    render(
      <ScanProgressBar
        threadsChecked={0}
        threadsDiscovered={0}
        status="FAILED"
        errorCode="cancelled"
      />,
    );
    const bar = screen.getByRole("progressbar", { name: "Scan progress" });
    expect(bar).toHaveAttribute("aria-valuenow", "0");
    expect(bar).toHaveAttribute(
      "aria-valuetext",
      "Scan stopped before conversations were checked.",
    );
  });
});
