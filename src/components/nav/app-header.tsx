import { BarChart3, Inbox, LayoutDashboard, Newspaper, ScanSearch, Settings } from "lucide-react";
import Link from "next/link";

import { Logo } from "@/components/brand/logo";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { Button } from "@/components/ui/button";
import { isUsageTelemetryUiEnabled } from "@/lib/config/features";
import { cn } from "@/lib/utils";

const BASE_NAV = [
  { href: "dashboard", label: "Dashboard", path: "/dashboard" },
  { href: "scan", label: "Scan", path: "/scan" },
  { href: "mail", label: "Mail", path: "/mail" },
  { href: "digests", label: "Digests", path: "/digests" },
  { href: "settings", label: "Settings", path: "/settings" },
] as const;

const USAGE_NAV = { href: "usage", label: "Usage", path: "/usage" } as const;

const NAV_ICONS = {
  dashboard: LayoutDashboard,
  scan: ScanSearch,
  mail: Inbox,
  digests: Newspaper,
  settings: Settings,
  usage: BarChart3,
} as const;

export type AppNavCurrent =
  (typeof BASE_NAV)[number]["href"] | typeof USAGE_NAV.href | "thread" | "onboarding";

export function AppHeader({ email, current }: { email?: string | null; current: AppNavCurrent }) {
  const nav = isUsageTelemetryUiEnabled() ? [...BASE_NAV, USAGE_NAV] : [...BASE_NAV];

  return (
    <header className="border-sidebar-border bg-sidebar text-sidebar-foreground sticky top-0 z-40 border-b lg:fixed lg:inset-y-0 lg:flex lg:w-60 lg:flex-col lg:border-r lg:border-b-0">
      <div className="flex items-center justify-between gap-3 px-4 py-3 lg:px-4 lg:py-5">
        <Link
          href="/dashboard"
          className="focus-visible:ring-ring shrink-0 rounded-lg hover:opacity-90 focus-visible:ring-3 focus-visible:outline-none"
          aria-label="MailPriority home"
        >
          <Logo />
        </Link>
        <div className="flex items-center gap-1 lg:hidden">
          <ThemeToggle />
          <SignOutForm />
        </div>
      </div>
      <nav
        aria-label="Main"
        className="flex gap-1 overflow-x-auto px-3 pb-3 lg:flex-1 lg:flex-col lg:overflow-visible lg:px-3 lg:pb-0"
      >
        {nav.map((item) => {
          const Icon = NAV_ICONS[item.href];
          const active = current === item.href;
          return (
            <Link
              key={item.href}
              href={item.path}
              aria-current={active ? "page" : undefined}
              className={cn(
                "focus-visible:ring-ring inline-flex min-h-10 items-center gap-2 rounded-lg px-3 text-sm whitespace-nowrap transition-colors focus-visible:ring-3 focus-visible:outline-none lg:w-full",
                active
                  ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                  : "text-muted-foreground hover:bg-sidebar-accent/70 hover:text-foreground",
              )}
            >
              <Icon className="size-4 shrink-0" aria-hidden />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="border-sidebar-border mt-auto hidden gap-3 border-t px-4 py-4 lg:grid">
        {email ? (
          <span className="text-muted-foreground truncate text-sm" title={email}>
            {email}
          </span>
        ) : null}
        <div className="flex items-center justify-between gap-2">
          <ThemeToggle />
          <SignOutForm />
        </div>
      </div>
    </header>
  );
}

function SignOutForm() {
  return (
    <form action="/auth/signout" method="post">
      <Button type="submit" variant="outline" size="sm">
        Sign out
      </Button>
    </form>
  );
}
