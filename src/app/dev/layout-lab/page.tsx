"use client";

import { notFound } from "next/navigation";
import { useSyncExternalStore } from "react";

import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { AppHeader } from "@/components/nav/app-header";
import { Card, CardContent } from "@/components/ui/card";
import { SIDEBAR_STORAGE_KEY } from "@/lib/ui/sidebar";

function subscribeNoop() {
  return () => {};
}

function prepareLayoutLabClient(): true {
  window.localStorage.setItem(SIDEBAR_STORAGE_KEY, "1");
  document.documentElement.classList.add("dark");
  return true;
}

/**
 * Local-only layout lab for overflow / zoom / phone regression screenshots.
 * Unavailable in production builds. Uses inline markup (not action/mail query
 * modules) so it stays on the safe side of the client import boundary.
 */
export default function LayoutLabPage() {
  if (process.env.NODE_ENV === "production") {
    notFound();
  }

  const ready = useSyncExternalStore(subscribeNoop, prepareLayoutLabClient, () => false);

  if (!ready) {
    return null;
  }

  const primaryStats = [
    { label: "Actions", value: "3" },
    { label: "Pending", value: "2" },
    { label: "For You", value: "5" },
    { label: "Ignored", value: "12" },
  ];

  return (
    <AppShell header={<AppHeader email="layout.lab@example.com" current="dashboard" />}>
      <PageHeader
        title="Inbox overview"
        description="Layout lab — collapsed sidebar, zoom, and phone overflow checks."
      />

      <div className="bg-card ring-foreground/10 min-w-0 rounded-xl px-4 py-4 shadow-xs ring-1">
        <p className="font-medium tracking-tight">Last scan</p>
        <dl className="mt-3 grid min-w-0 grid-cols-2 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className="min-w-0">
            <dt className="text-muted-foreground text-xs leading-snug break-words">
              Emails scanned
            </dt>
            <dd className="mt-0.5 text-lg font-semibold tabular-nums">128</dd>
          </div>
          <div className="min-w-0">
            <dt className="text-muted-foreground text-xs leading-snug break-words">
              Conversations checked
            </dt>
            <dd className="mt-0.5 text-lg font-semibold tabular-nums">64</dd>
          </div>
          <div className="min-w-0">
            <dt className="text-muted-foreground text-xs leading-snug break-words">Status</dt>
            <dd className="mt-0.5 text-sm font-medium">Success</dd>
          </div>
          <div className="min-w-0">
            <dt className="text-muted-foreground text-xs leading-snug break-words">Finished</dt>
            <dd className="mt-0.5 text-sm font-medium">Just now</dd>
          </div>
        </dl>
      </div>

      <section className="min-w-0 space-y-3">
        <h2 className="text-foreground text-lg font-semibold tracking-tight">Inbox now</h2>
        <div className="grid min-w-0 grid-cols-2 gap-3 xl:grid-cols-4">
          {primaryStats.map((stat) => (
            <Card
              key={stat.label}
              className="hover:bg-muted/40 h-full min-w-0 transition-[background-color,box-shadow] duration-150 hover:shadow-sm"
            >
              <CardContent className="min-w-0">
                <div className="text-3xl font-semibold tracking-tight tabular-nums">
                  {stat.value}
                </div>
                <div className="text-muted-foreground mt-1 text-sm leading-snug break-words">
                  {stat.label}
                </div>
              </CardContent>
            </Card>
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
