export const SIDEBAR_STORAGE_KEY = "mailpilot.sidebar-collapsed";

/** Desktop sidebar rail width when minimized (Tailwind `w-16`). */
export const SIDEBAR_COLLAPSED_WIDTH_CLASS = "lg:w-16";

/** Desktop sidebar width when expanded (Tailwind `w-60`). */
export const SIDEBAR_EXPANDED_WIDTH_CLASS = "lg:w-60";

/** Main content offset matching collapsed rail. */
export const SIDEBAR_COLLAPSED_PAD_CLASS = "lg:pl-16";

/** Main content offset matching expanded rail. */
export const SIDEBAR_EXPANDED_PAD_CLASS = "lg:pl-60";

export function parseSidebarCollapsed(raw: string | null | undefined): boolean {
  return raw === "1" || raw === "true" || raw === "collapsed";
}

export function serializeSidebarCollapsed(collapsed: boolean): string {
  return collapsed ? "1" : "0";
}
