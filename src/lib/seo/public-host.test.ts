import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { LAUNCH_APP_ORIGIN } from "@/lib/seo/public-host";

const DOC_PATHS = ["README.md", "AGENTS.md", "docs/PRODUCT.md", "docs/SETUP.md"] as const;

describe("launch host", () => {
  it("documents mail-priority.vercel.app as the public app", () => {
    expect(LAUNCH_APP_ORIGIN).toBe("https://mail-priority.vercel.app");
    for (const path of DOC_PATHS) {
      const text = readFileSync(path, "utf8");
      expect(text).toContain(LAUNCH_APP_ORIGIN);
      expect(text).not.toMatch(/launch host is not chosen/i);
    }
    const setup = readFileSync("docs/SETUP.md", "utf8").replace(/\r\n/g, "\n");
    expect(setup).toContain(`Site URL =\n   \`${LAUNCH_APP_ORIGIN}\``);
    expect(setup).not.toContain("https://gmailpilot.vercel.app/auth/confirm");
  });
});
