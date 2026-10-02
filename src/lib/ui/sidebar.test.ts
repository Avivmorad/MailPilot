import { describe, expect, it } from "vitest";

import {
  parseSidebarCollapsed,
  serializeSidebarCollapsed,
  SIDEBAR_STORAGE_KEY,
} from "@/lib/ui/sidebar";

describe("sidebar collapsed preference", () => {
  it("uses a namespaced storage key", () => {
    expect(SIDEBAR_STORAGE_KEY).toBe("mailpilot.sidebar-collapsed");
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
