import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export function AppShell({
  header,
  children,
  width = "wide",
}: {
  header: ReactNode;
  children: ReactNode;
  width?: "wide" | "narrow";
}) {
  return (
    <div className="flex min-h-full flex-col">
      {header}
      <main
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
