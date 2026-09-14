import { describe, expect, it } from "vitest";

import {
  parseStoredTheme,
  THEME_INIT_SCRIPT,
  THEME_STORAGE_KEY,
  themeIsDark,
} from "@/lib/ui/theme";

describe("theme", () => {
  it("parses stored preferences and defaults to system", () => {
    expect(parseStoredTheme("dark")).toBe("dark");
    expect(parseStoredTheme("light")).toBe("light");
    expect(parseStoredTheme("system")).toBe("system");
    expect(parseStoredTheme("nope")).toBe("system");
    expect(parseStoredTheme(null)).toBe("system");
    expect(THEME_STORAGE_KEY).toBe("mailpilot.theme");
  });

  it("resolves system preference to dark or light", () => {
    expect(themeIsDark("dark", false)).toBe(true);
    expect(themeIsDark("light", true)).toBe(false);
    expect(themeIsDark("system", true)).toBe(true);
    expect(themeIsDark("system", false)).toBe(false);
  });

  it("derives the inline theme bootstrap storage key from the shared constant", () => {
    expect(THEME_INIT_SCRIPT).toContain(`var k=${JSON.stringify(THEME_STORAGE_KEY)}`);
    expect(THEME_INIT_SCRIPT).not.toContain("${");
  });
});
