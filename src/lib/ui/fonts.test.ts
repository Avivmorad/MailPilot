import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

function collectSourceFiles(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      collectSourceFiles(full, acc);
      continue;
    }
    if (/\.(tsx?|css)$/.test(entry.name) && !entry.name.includes(".test.")) {
      acc.push(full);
    }
  }
  return acc;
}

describe("app fonts", () => {
  it("does not download Google Fonts at build time", () => {
    const files = collectSourceFiles(path.join(process.cwd(), "src"));
    expect(files.length).toBeGreaterThan(0);

    for (const file of files) {
      const raw = readFileSync(file, "utf8");
      expect(raw, file).not.toContain("next/font/google");
      expect(raw, file).not.toContain("fonts.googleapis.com");
      expect(raw, file).not.toContain("fonts.gstatic.com");
    }
  });
});
