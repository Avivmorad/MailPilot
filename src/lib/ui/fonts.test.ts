import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

describe("app fonts", () => {
  it("does not download Google Fonts at build time", () => {
    const raw = readFileSync(path.join(process.cwd(), "src/app/layout.tsx"), "utf8");
    expect(raw).not.toContain("next/font/google");
  });
});
