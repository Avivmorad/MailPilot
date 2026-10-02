"use client";

import type { ReactNode } from "react";

import { SkipToContent } from "@/components/layout/skip-to-content";
import { SIDEBAR_COLLAPSED_PAD_CLASS, SIDEBAR_EXPANDED_PAD_CLASS } from "@/lib/ui/sidebar";
import { useSidebarCollapsed } from "@/lib/ui/use-sidebar-collapsed";
import { cn } from "@/lib/utils";

export function AppShell({
  header,
  banner,
  children,
  width = "wide",
}: {
  header: ReactNode;
  banner?: ReactNode;
  children: ReactNode;
  width?: "wide" | "narrow";
}) {
  const [collapsed] = useSidebarCollapsed();

  return (
    <div
      className={cn(
        "flex min-h-full flex-col lg:transition-[padding]",
        collapsed ? SIDEBAR_COLLAPSED_PAD_CLASS : SIDEBAR_EXPANDED_PAD_CLASS,
      )}
    >
      <SkipToContent />
      {header}
      {banner}
      <main
        id="main-content"
        tabIndex={-1}
        className={cn(
          "mx-auto w-full flex-1 px-4 py-8 sm:px-6 sm:py-10",
          width === "wide" ? "max-w-6xl space-y-8" : "max-w-3xl space-y-6",
        )}
      >
        {children}
      </main>
    </div>
  );
}
