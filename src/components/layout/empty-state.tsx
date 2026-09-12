import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export function EmptyState({
  title,
  description,
  action,
  variant = "default",
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  variant?: "default" | "error";
}) {
  const isError = variant === "error";
  return (
    <div
      className={cn(
        "bg-card rounded-xl border border-dashed px-5 py-10 text-center",
        isError ? "border-destructive/40 bg-destructive/5" : "border-border/80",
      )}
      role={isError ? "alert" : "status"}
    >
      <p
        className={cn(
          "font-semibold tracking-tight",
          isError ? "text-destructive" : "text-foreground",
        )}
      >
        {title}
      </p>
      {description ? (
        <p className="text-muted-foreground mx-auto mt-1.5 max-w-md text-sm leading-relaxed">
          {description}
        </p>
      ) : null}
      {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
    </div>
  );
}
