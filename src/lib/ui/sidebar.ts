export const SIDEBAR_STORAGE_KEY = "mailpilot.sidebar-collapsed";

/**
 * Desktop sidebar widths as rem-based CSS variables (see globals.css).
 * Prefer these over hard-coded Tailwind width utilities so the rail and the
 * main content offset stay in sync at every browser zoom level.
 */
export const SIDEBAR_WIDTH_EXPANDED = "15rem";
export const SIDEBAR_WIDTH_COLLAPSED = "4.75rem";

/** Desktop sidebar rail width when minimized. */
export const SIDEBAR_COLLAPSED_WIDTH_CLASS = "lg:w-[var(--app-sidebar-width-collapsed)]";

/** Desktop sidebar width when expanded. */
export const SIDEBAR_EXPANDED_WIDTH_CLASS = "lg:w-[var(--app-sidebar-width-expanded)]";

/** Main content offset matching collapsed rail. */
export const SIDEBAR_COLLAPSED_PAD_CLASS = "lg:pl-[var(--app-sidebar-width-collapsed)]";

/** Main content offset matching expanded rail. */
export const SIDEBAR_EXPANDED_PAD_CLASS = "lg:pl-[var(--app-sidebar-width-expanded)]";

export function parseSidebarCollapsed(raw: string | null | undefined): boolean {
  return raw === "1" || raw === "true" || raw === "collapsed";
}

export function serializeSidebarCollapsed(collapsed: boolean): string {
  return collapsed ? "1" : "0";
}
