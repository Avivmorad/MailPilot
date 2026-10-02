import { describe, expect, it } from "vitest";

import { isUsageTelemetryUiEnabled } from "@/lib/config/features";

describe("isUsageTelemetryUiEnabled", () => {
  it("is off by default", () => {
    expect(isUsageTelemetryUiEnabled({})).toBe(false);
    expect(isUsageTelemetryUiEnabled({ NEXT_PUBLIC_USAGE_TELEMETRY_UI: "" })).toBe(false);
    expect(isUsageTelemetryUiEnabled({ NEXT_PUBLIC_USAGE_TELEMETRY_UI: "0" })).toBe(false);
  });

  it("turns on only for exact 1", () => {
    expect(isUsageTelemetryUiEnabled({ NEXT_PUBLIC_USAGE_TELEMETRY_UI: "1" })).toBe(true);
  });
});
