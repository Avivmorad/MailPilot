"use client";

import { notFound } from "next/navigation";
import { useEffect, useState } from "react";

import { ActionItemCard } from "@/components/actions/action-item-card";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { AppHeader } from "@/components/nav/app-header";
import { InboxSummary } from "@/components/threads/inbox-summary";
import { Card, CardContent } from "@/components/ui/card";
import type { ActionListItem } from "@/lib/actions/queries";
import { SIDEBAR_STORAGE_KEY } from "@/lib/ui/sidebar";
import type { RecentThreadRow } from "@/lib/threads/queries";

/**
 * Local-only layout lab for overflow / zoom / phone regression screenshots.
 * Unavailable in production builds.
 */
export default function LayoutLabPage() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (process.env.NODE_ENV === "production") {
      return;
    }
    window.localStorage.setItem(SIDEBAR_STORAGE_KEY, "1");
    document.documentElement.classList.add("dark");
    setReady(true);
  }, []);

  if (process.env.NODE_ENV === "production") {
    notFound();
  }

  if (!ready) {
    return null;
  }

  const sampleAction: ActionListItem = {
    id: "lab-action-1",
    threadId: "lab-thread-1",
    status: "OPEN",
    title:
      "Please review the extremely-long-unbroken-token-ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 and confirm the booking",
    description: null,
    actionSummary:
      "Reply with confirmation before Friday — https://example.com/very/long/path/that/should/wrap/instead/of/overflowing/the/card/container",
    actionReason: "Sender asked for a decision and the deadline is near.",
    waitingFor: null,
    snoozedUntil: null,
    deadline: null,
    urgency: "high",
    latestMessageAt: new Date().toISOString(),
    importance: "high",
    summary: null,
    sender: "hotel.reservations@verylongdomainname.example.com",
    gmailUrl: "https://mail.google.com",
    category: "travel",
    actionType: "reply",
    confidence: 0.91,
    updatedAt: new Date().toISOString(),
  };

  const sampleThreads: RecentThreadRow[] = [
    {
      id: "lab-thread-2",
      subject:
        "Re: SupercalifragilisticexpialidociousUnbrokenSubjectLineThatMustNotEscapeItsContainerOnPhone",
      shortDisplayTitle: "Hotel asked about late checkout and minibar charges",
      summary:
        "They need your answer on late checkout plus a long URL https://booking.example.com/reservations/abcdef/details?token=zzzzzzzzzzzzzzzzzzzzzzzzzzzz",
      status: "informational",
      category: "travel",
      importance: "medium",
      latestMessageAt: new Date().toISOString(),
    },
  ];

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
        <ActionItemCard item={sampleAction} />
      </section>

      <section className="min-w-0 space-y-3">
        <h2 className="text-foreground text-lg font-semibold tracking-tight">Mail preview</h2>
        <InboxSummary threads={sampleThreads} storageKey="layout-lab-mail" />
      </section>
    </AppShell>
  );
}
