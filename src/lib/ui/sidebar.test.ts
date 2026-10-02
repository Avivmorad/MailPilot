import { describe, expect, it } from "vitest";

import {
  parseSidebarCollapsed,
  serializeSidebarCollapsed,
  SIDEBAR_COLLAPSED_PAD_CLASS,
  SIDEBAR_COLLAPSED_WIDTH_CLASS,
  SIDEBAR_EXPANDED_PAD_CLASS,
  SIDEBAR_EXPANDED_WIDTH_CLASS,
  SIDEBAR_STORAGE_KEY,
  SIDEBAR_WIDTH_COLLAPSED,
  SIDEBAR_WIDTH_EXPANDED,
} from "@/lib/ui/sidebar";

describe("sidebar collapsed preference", () => {
  it("uses a namespaced storage key", () => {
    expect(SIDEBAR_STORAGE_KEY).toBe("mailpilot.sidebar-collapsed");
  });

  it("exposes rem-based CSS variable width classes so pad and rail stay in sync", () => {
    expect(SIDEBAR_WIDTH_EXPANDED).toBe("15rem");
    expect(SIDEBAR_WIDTH_COLLAPSED).toBe("4.75rem");
    expect(SIDEBAR_COLLAPSED_WIDTH_CLASS).toContain("--app-sidebar-width-collapsed");
    expect(SIDEBAR_COLLAPSED_PAD_CLASS).toContain("--app-sidebar-width-collapsed");
    expect(SIDEBAR_EXPANDED_WIDTH_CLASS).toContain("--app-sidebar-width-expanded");
    expect(SIDEBAR_EXPANDED_PAD_CLASS).toContain("--app-sidebar-width-expanded");
    expect(SIDEBAR_COLLAPSED_WIDTH_CLASS.replace("lg:w-", "")).toBe(
      SIDEBAR_COLLAPSED_PAD_CLASS.replace("lg:pl-", ""),
    );
    expect(SIDEBAR_EXPANDED_WIDTH_CLASS.replace("lg:w-", "")).toBe(
      SIDEBAR_EXPANDED_PAD_CLASS.replace("lg:pl-", ""),
    );
  });

  it("parses known collapsed values and treats anything else as expanded", () => {
    expect(parseSidebarCollapsed("1")).toBe(true);
    expect(parseSidebarCollapsed("true")).toBe(true);
    expect(parseSidebarCollapsed("collapsed")).toBe(true);
    expect(parseSidebarCollapsed("0")).toBe(false);
    expect(parseSidebarCollapsed("false")).toBe(false);
    expect(parseSidebarCollapsed(null)).toBe(false);
    expect(parseSidebarCollapsed(undefined)).toBe(false);
    expect(parseSidebarCollapsed("")).toBe(false);
  });

  it("serializes a stable localStorage value", () => {
    expect(serializeSidebarCollapsed(true)).toBe("1");
    expect(serializeSidebarCollapsed(false)).toBe("0");
  });
});
