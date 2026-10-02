"use client";

import {
  BarChart3,
  ChevronLeft,
  ChevronRight,
  Inbox,
  LayoutDashboard,
  LogOut,
  Newspaper,
  ScanSearch,
  Settings,
} from "lucide-react";
import Link from "next/link";

import { Logo } from "@/components/brand/logo";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { Button } from "@/components/ui/button";
import { isUsageTelemetryUiEnabled } from "@/lib/config/features";
import { SIDEBAR_COLLAPSED_WIDTH_CLASS, SIDEBAR_EXPANDED_WIDTH_CLASS } from "@/lib/ui/sidebar";
import { useSidebarCollapsed } from "@/lib/ui/use-sidebar-collapsed";
import { cn } from "@/lib/utils";

const BASE_NAV = [
  { href: "dashboard", label: "Dashboard", path: "/dashboard" },
  { href: "scan", label: "Scan", path: "/scan" },
  { href: "mail", label: "Mail", path: "/mail" },
  { href: "history", label: "History", path: "/history" },
  { href: "settings", label: "Settings", path: "/settings" },
] as const;

const USAGE_NAV = { href: "usage", label: "Usage", path: "/usage" } as const;

const NAV_ICONS = {
  dashboard: LayoutDashboard,
  scan: ScanSearch,
  mail: Inbox,
  history: Newspaper,
  settings: Settings,
  usage: BarChart3,
} as const;

export type AppNavCurrent =
  (typeof BASE_NAV)[number]["href"] | typeof USAGE_NAV.href | "thread" | "onboarding";

export function AppHeader({ email, current }: { email?: string | null; current: AppNavCurrent }) {
  const nav = isUsageTelemetryUiEnabled() ? [...BASE_NAV, USAGE_NAV] : [...BASE_NAV];
  const [collapsed, setCollapsed] = useSidebarCollapsed();

  return (
    <header
      className={cn(
        "border-sidebar-border bg-sidebar text-sidebar-foreground sticky top-0 z-40 border-b lg:fixed lg:inset-y-0 lg:flex lg:flex-col lg:border-r lg:border-b-0 lg:transition-[width]",
        collapsed ? SIDEBAR_COLLAPSED_WIDTH_CLASS : SIDEBAR_EXPANDED_WIDTH_CLASS,
      )}
    >
      <div
        className={cn(
          "flex items-center justify-between gap-3 px-4 py-3 lg:py-5",
          collapsed ? "lg:flex-col lg:gap-3 lg:px-2" : "lg:px-4",
        )}
      >
        <Link
          href="/dashboard"
          className="focus-visible:ring-ring shrink-0 rounded-lg hover:opacity-90 focus-visible:ring-3 focus-visible:outline-none"
          aria-label="MailPriority home"
        >
          <span className="inline-flex lg:hidden">
            <Logo />
          </span>
          <span className="hidden lg:inline-flex">
            <Logo showWordmark={!collapsed} />
          </span>
        </Link>
        <div className="flex items-center gap-1 lg:hidden">
          <ThemeToggle />
          <SignOutForm />
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="text-muted-foreground hover:text-foreground hidden shrink-0 lg:inline-flex"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          aria-expanded={!collapsed}
          aria-controls="app-sidebar-nav"
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          onClick={() => setCollapsed(!collapsed)}
        >
          {collapsed ? <ChevronRight aria-hidden /> : <ChevronLeft aria-hidden />}
        </Button>
      </div>
      <nav
        id="app-sidebar-nav"
        aria-label="Main"
        className={cn(
          "flex gap-1 overflow-x-auto px-3 pb-3 lg:flex-1 lg:flex-col lg:overflow-visible lg:pb-0",
          collapsed ? "lg:items-center lg:px-2" : "lg:px-3",
        )}
      >
        {nav.map((item) => {
          const Icon = NAV_ICONS[item.href];
          const active = current === item.href;
          return (
            <Link
              key={item.href}
              href={item.path}
              aria-current={active ? "page" : undefined}
              title={item.label}
              className={cn(
                "focus-visible:ring-ring inline-flex min-h-10 items-center gap-2 rounded-lg px-3 text-sm whitespace-nowrap transition-colors focus-visible:ring-3 focus-visible:outline-none lg:w-full",
                collapsed && "lg:w-10 lg:justify-center lg:px-0",
                active
                  ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                  : "text-muted-foreground hover:bg-sidebar-accent/70 hover:text-foreground",
              )}
            >
              <Icon className="size-4 shrink-0" aria-hidden />
              <span className={cn(collapsed && "lg:sr-only")}>{item.label}</span>
            </Link>
          );
        })}
      </nav>
      <div
        className={cn(
          "border-sidebar-border mt-auto hidden gap-3 border-t py-4 lg:grid",
          collapsed ? "lg:justify-items-center lg:px-2" : "lg:px-4",
        )}
      >
        {email && !collapsed ? (
          <span className="text-muted-foreground truncate text-sm" title={email}>
            {email}
          </span>
        ) : null}
        <div className={cn("flex items-center gap-2", collapsed ? "flex-col" : "justify-between")}>
          <ThemeToggle />
          <SignOutForm iconOnly={collapsed} />
        </div>
      </div>
    </header>
  );
}

function SignOutForm({ iconOnly = false }: { iconOnly?: boolean }) {
  return (
    <form action="/auth/signout" method="post">
      {iconOnly ? (
        <Button
          type="submit"
          variant="outline"
          size="icon-sm"
          aria-label="Sign out"
          title="Sign out"
        >
          <LogOut aria-hidden />
        </Button>
      ) : (
        <Button type="submit" variant="outline" size="sm">
          Sign out
        </Button>
      )}
    </form>
  );
}
