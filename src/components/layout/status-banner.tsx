import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import type { AppBanner } from "@/lib/ui/status-banner";
import { cn } from "@/lib/utils";

const KIND_CLASS: Record<AppBanner["kind"], string> = {
  info: "border-primary/25 bg-primary/8 text-foreground",
  warning: "border-orange-500/30 bg-orange-500/10 text-foreground",
  error: "border-destructive/30 bg-destructive/10 text-foreground",
};

export function StatusBanner({ kind, title, body, href, actionLabel }: AppBanner) {
  return (
    <div
      className={cn("border-b px-4 py-3 sm:px-6", KIND_CLASS[kind])}
      role={kind === "error" ? "alert" : "status"}
    >
      <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="font-medium tracking-tight">{title}</p>
          <p className="text-muted-foreground mt-0.5 text-sm leading-relaxed">{body}</p>
        </div>
        {href && actionLabel ? (
          href.startsWith("/api/") ? (
            <a href={href} className={buttonVariants({ size: "sm" })}>
              {actionLabel}
            </a>
          ) : (
            <Link href={href} className={buttonVariants({ size: "sm" })}>
              {actionLabel}
            </Link>
          )
        ) : null}
      </div>
    </div>
  );
}
