/** @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  DAILY_SCAN_CARD_DESCRIPTION,
  DAILY_SCAN_SAVED_MESSAGE,
} from "@/lib/settings/schedule-copy";

const refresh = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh }),
}));

import { ScanPreferencesForm } from "@/components/settings/scan-preferences-form";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  refresh.mockReset();
});

describe("ScanPreferencesForm", () => {
  it("stores a local time without promising a run at that time", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    render(<ScanPreferencesForm dailyScanTime="08:00" timezone="Asia/Jerusalem" />);

    expect(screen.getByText(DAILY_SCAN_CARD_DESCRIPTION)).toBeInTheDocument();
    expect(screen.queryByText(/once a day at this local time/i)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save schedule" })).toBeEnabled();

    fireEvent.click(screen.getByRole("button", { name: "Save schedule" }));

    expect(await screen.findByText(DAILY_SCAN_SAVED_MESSAGE)).toBeInTheDocument();
    expect(screen.queryByText(/next scheduled run was updated/i)).not.toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/settings",
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({ dailyScanTime: "08:00", timezone: "Asia/Jerusalem" }),
      }),
    );
  });
});
