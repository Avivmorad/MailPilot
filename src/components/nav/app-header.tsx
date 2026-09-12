import Link from "next/link";

import { Logo } from "@/components/brand/logo";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "dashboard", label: "Dashboard", path: "/dashboard" },
  { href: "mail", label: "Mail", path: "/mail" },
  { href: "digests", label: "Digests", path: "/digests" },
  { href: "settings", label: "Settings", path: "/settings" },
] as const;

export type AppNavCurrent = (typeof NAV)[number]["href"] | "thread" | "onboarding";

export function AppHeader({ email, current }: { email?: string | null; current: AppNavCurrent }) {
  return (
    <header className="border-border/70 bg-background/85 sticky top-0 z-40 border-b backdrop-blur-md">
      <div className="mx-auto flex w-full max-w-6xl items-center gap-3 px-4 py-3 sm:px-6">
        <Link
          href="/dashboard"
          className="focus-visible:ring-ring shrink-0 rounded-lg hover:opacity-90 focus-visible:ring-3 focus-visible:outline-none"
          aria-label="GmailPilot home"
        >
          <Logo />
        </Link>
        <nav
          aria-label="Main"
          className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto sm:gap-2"
        >
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.path}
              aria-current={current === item.href ? "page" : undefined}
              className={cn(
                "focus-visible:ring-ring inline-flex min-h-10 items-center rounded-lg px-2.5 py-1.5 text-sm whitespace-nowrap transition-colors focus-visible:ring-3 focus-visible:outline-none sm:px-3",
                current === item.href
                  ? "bg-muted text-foreground font-medium"
                  : "text-muted-foreground hover:bg-muted/70 hover:text-foreground",
              )}
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="flex shrink-0 items-center gap-1 sm:gap-2">
          {email ? (
            <span
              className="text-muted-foreground hidden max-w-48 truncate text-sm lg:inline"
              title={email}
            >
              {email}
            </span>
          ) : null}
          <ThemeToggle />
          <form action="/auth/signout" method="post">
            <Button type="submit" variant="outline" size="sm">
              Sign out
            </Button>
          </form>
        </div>
      </div>
    </header>
  );
}
