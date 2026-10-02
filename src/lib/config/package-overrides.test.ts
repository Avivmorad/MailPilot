import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const REQUIRED_PINS = {
  "proxy-addr": "2.0.8",
  "fast-uri": "3.1.8",
  "ip-address": "10.7.2",
  "brace-expansion@1": "1.1.21",
  "brace-expansion@5": "5.0.12",
} as const;

describe("package.json overrides", () => {
  it("keeps every dependency pin in the one overrides object npm installs", () => {
    const raw = readFileSync("package.json", "utf8");
    const topLevelOverrides = raw.match(/^ {2}"overrides":/gm) ?? [];
    expect(topLevelOverrides).toHaveLength(1);

    const parsed = JSON.parse(raw) as { overrides?: Record<string, string> };
    expect(parsed.overrides).toMatchObject(REQUIRED_PINS);
  });
});

describe("scan attribution migration notes", () => {
  it("records the migration as applied on mailpilot-dev", () => {
    const setup = readFileSync("docs/SETUP.md", "utf8");
    const readme = readFileSync("supabase/README.md", "utf8");
    for (const text of [setup, readme]) {
      expect(text).toContain("20260929174644_analysis_scan_attribution.sql");
      expect(text).toContain("Applied on `mailpilot-dev`");
      expect(text).not.toMatch(
        /not recorded as applied|not applied or database-verified|drafted locally/i,
      );
    }
  });
});
