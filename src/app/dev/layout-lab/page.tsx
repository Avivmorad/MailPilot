"use client";

import { notFound } from "next/navigation";
import { useSyncExternalStore } from "react";

import { AppShell } from "@/components/layout/app-shell";
import { InboxOverviewHeader } from "@/components/dashboard/inbox-overview-header";
import { InboxStatCard } from "@/components/dashboard/inbox-stat-card";
import { AppHeader } from "@/components/nav/app-header";
import { Button } from "@/components/ui/button";
import { SIDEBAR_STORAGE_KEY } from "@/lib/ui/sidebar";
import { THEME_STORAGE_KEY } from "@/lib/ui/theme";

function subscribeNoop() {
  return () => {};
}

function readLabTheme(): "light" | "dark" {
  if (typeof window === "undefined") {
    return "dark";
  }
  const param = new URLSearchParams(window.location.search).get("theme");
  return param === "light" ? "light" : "dark";
}

function prepareLayoutLabClient(): true {
  window.localStorage.setItem(SIDEBAR_STORAGE_KEY, "1");
  const theme = readLabTheme();
  window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  document.documentElement.classList.toggle("dark", theme === "dark");
  return true;
}

/**
 * Local-only layout lab for overflow / zoom / phone regression screenshots.
 * Unavailable in production builds. Uses inline markup (not action/mail query
 * modules) so it stays on the safe side of the client import boundary.
 * Query `?theme=light` for light mode; default is dark.
 */
export default function LayoutLabPage() {
  if (process.env.NODE_ENV === "production") {
    notFound();
  }

  const ready = useSyncExternalStore(subscribeNoop, prepareLayoutLabClient, () => false);

  if (!ready) {
    return null;
  }

  const inboxStats = [
    { label: "Actions", value: "3", href: "/mail?tab=open" },
    { label: "Pending", value: "2", href: "/mail?tab=waiting" },
    { label: "For You", value: "5", href: "/mail?tab=summary" },
    { label: "Ignored", value: "12", href: "/mail?tab=ignored" },
    { label: "Closed", value: "4", href: "/mail?tab=completed" },
    { label: "Snoozed", value: "1", href: "/mail?tab=snoozed" },
    { label: "Important", value: "2" },
  ];

  return (
    <AppShell header={<AppHeader email="layout.lab@example.com" current="dashboard" />}>
      <InboxOverviewHeader description="Layout lab — collapsed sidebar, zoom, and phone overflow checks." />

      <section className="min-w-0 space-y-3">
        <h2 className="text-foreground text-lg font-semibold tracking-tight">Buttons</h2>
        <div className="flex min-w-0 flex-wrap items-center gap-3">
          <Button data-testid="lab-open-scan">Open scan</Button>
          <Button variant="outline">Outline</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="destructive">Destructive</Button>
        </div>
      </section>

      <div className="bg-card ring-foreground/10 flex min-w-0 flex-wrap items-center justify-between gap-3 rounded-xl px-4 py-4 shadow-xs ring-1">
        <div className="min-w-0">
          <p className="font-medium tracking-tight">Last scan</p>
          <p className="text-muted-foreground mt-0.5 text-sm break-normal">
            Success · Just now · 128 emails
          </p>
        </div>
        <Button data-testid="lab-last-scan-open" className="min-h-10 shrink-0 px-4">
          Open scan
        </Button>
      </div>

      <section className="min-w-0 space-y-3" data-testid="lab-scan-panel">
        <h2 className="text-foreground text-lg font-semibold tracking-tight">Scan tab preview</h2>
        <div className="bg-card ring-foreground/10 min-w-0 rounded-xl px-4 py-4 shadow-xs ring-1">
          <p className="font-medium tracking-tight">Initial scan</p>
          <p className="text-muted-foreground mt-0.5 text-sm">
            Checking conversations in the background. You can keep using MailPriority.
          </p>
          <div className="mt-4 flex min-w-0 flex-col gap-6">
            <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-center">
              <div className="bg-muted relative flex size-40 shrink-0 items-center justify-center rounded-full">
                <span className="text-3xl font-semibold tracking-tight tabular-nums">62%</span>
              </div>
              <p className="max-w-sm text-sm leading-relaxed">
                Checking 310 of 504 conversations (62%). Large scans continue automatically…
              </p>
            </div>
            <dl
              data-testid="lab-scan-progress-stats"
              className="grid min-w-0 grid-cols-[repeat(auto-fit,minmax(10rem,1fr))] gap-x-5 gap-y-3"
            >
              {[
                ["Conversations", "310 of 504"],
                ["Emails scanned", "842"],
                ["Actions", "12"],
                ["Pending", "4"],
                ["For You", "28"],
                ["Ignored", "91"],
                ["Important", "3"],
                ["Updated", "Oct 2, 2026, 3:14 PM"],
              ].map(([label, value]) => (
                <div key={label} className="min-w-0">
                  <dt className="text-muted-foreground text-xs leading-snug whitespace-nowrap">
                    {label}
                  </dt>
                  <dd className="mt-0.5 text-sm font-medium break-normal tabular-nums">{value}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </section>

      <section className="min-w-0 space-y-3">
        <h2 className="text-foreground text-lg font-semibold tracking-tight">Inbox now</h2>
        <div className="grid min-w-0 grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7">
          {inboxStats.map((stat) => (
            <InboxStatCard
              key={stat.label}
              label={stat.label}
              value={stat.value}
              href={stat.href}
            />
          ))}
        </div>
      </section>

      <section className="min-w-0 space-y-3">
        <h2 className="text-foreground text-lg font-semibold tracking-tight">Actions</h2>
        <article className="bg-card ring-foreground/10 min-w-0 overflow-hidden rounded-xl border-l-4 border-l-orange-500 p-4 shadow-xs ring-1 sm:p-5">
          <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0 flex-1 overflow-hidden">
              <h3
                className="text-foreground text-base leading-snug font-semibold tracking-tight [overflow-wrap:anywhere] break-words"
                dir="auto"
              >
                Please review the extremely-long-unbroken-token-ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789
                and confirm the booking
              </h3>
              <p
                className="text-muted-foreground mt-0.5 text-sm [overflow-wrap:anywhere] break-words"
                dir="auto"
              >
                hotel.reservations@verylongdomainname.example.com · just now
              </p>
            </div>
          </div>
          <div className="mt-3 min-w-0 space-y-1 overflow-hidden">
            <p className="min-w-0 text-sm leading-relaxed [overflow-wrap:anywhere] break-words">
              <span className="text-muted-foreground">Do: </span>
              <span className="text-foreground">
                Reply with confirmation before Friday —
                https://example.com/very/long/path/that/should/wrap/instead/of/overflowing/the/card/container
              </span>
            </p>
          </div>
        </article>
      </section>

      <section className="min-w-0 space-y-3">
        <h2 className="text-foreground text-lg font-semibold tracking-tight">Mail preview</h2>
        <div className="bg-card ring-foreground/10 min-w-0 overflow-hidden rounded-xl ring-1">
          <div className="border-b px-4 py-2.5 text-sm font-semibold">Travel & Transport</div>
          <ul className="divide-y">
            <li className="min-w-0 overflow-hidden px-4 py-3">
              <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between">
                <div className="min-w-0 flex-1 overflow-hidden">
                  <p
                    className="text-foreground leading-snug font-semibold tracking-tight [overflow-wrap:anywhere] break-words"
                    dir="auto"
                  >
                    Hotel asked about late checkout and minibar charges
                  </p>
                  <p
                    className="text-muted-foreground mt-1 line-clamp-2 text-sm leading-relaxed [overflow-wrap:anywhere] break-words"
                    dir="auto"
                  >
                    They need your answer on late checkout plus a long URL
                    https://booking.example.com/reservations/abcdef/details?token=zzzzzzzzzzzzzzzzzzzzzzzzzzzz
                  </p>
                </div>
              </div>
            </li>
          </ul>
        </div>
      </section>
    </AppShell>
  );
}
