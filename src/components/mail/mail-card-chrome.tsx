import type { ReactNode } from "react";
import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Full-width title slot. `text-center` centers the short display title in the
 * card. `dir="auto"` on the heading keeps Hebrew/RTL reading order.
 */
export function MailCardTitle({
  title,
  children,
  className,
}: {
  title: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("w-full min-w-0 text-center", className)} data-slot="mail-card-title">
      <h3
        className="text-foreground mx-auto max-w-full text-base leading-snug font-semibold tracking-tight [overflow-wrap:anywhere] break-words"
        dir="auto"
        title={title}
      >
        {children}
      </h3>
    </div>
  );
}

/** In-app thread view. Navy primary button; hover is the shared lift, not a glow. */
export function MailOpenLink({ href }: { href: string }) {
  return (
    <Link
      href={href}
      className={cn(buttonVariants({ size: "sm" }), "min-h-10 w-full shrink-0 px-4 sm:w-auto")}
    >
      Open
    </Link>
  );
}
