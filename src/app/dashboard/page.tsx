import { Clock3, Inbox, ListChecks, ShieldAlert } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { GroupedActionList } from "@/components/actions/grouped-action-list";
import { GmailConnectionCard } from "@/components/gmail/gmail-connection-card";
import { AppShell } from "@/components/layout/app-shell";
import { CollapsibleBlock } from "@/components/layout/collapsible-block";
import { PageHeader } from "@/components/layout/page-header";
import { AppHeader } from "@/components/nav/app-header";
import { InitialScanCard } from "@/components/scans/initial-scan-card";
import { InboxSummary } from "@/components/threads/inbox-summary";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { listActionsForUser } from "@/lib/actions/queries";
import { getGmailStatusForUser } from "@/lib/gmail/connections";
import { getInboxCountsForUser, getLatestScanRunForUser } from "@/lib/scans/manual";
import { getSessionUser } from "@/lib/supabase/auth";
import { listRecentThreadsForUser } from "@/lib/threads/queries";
import { formatDateTime } from "@/lib/ui/format";
import { labelForScanStatus } from "@/lib/ui/labels";

export const dynamic = "force-dynamic";

function dashboardDescription({
  connected,
  scanDone,
  latestStatus,
}: {
  connected: boolean;
  scanDone: boolean;
  latestStatus: string | null;
}): string {
  if (!connected) {
    return "Connect Gmail to start triaging your inbox.";
  }
  if (scanDone) {
    return "Scan finished. The numbers below are live from your mailbox.";
  }
  if (latestStatus === "RUNNING") {
    return "A scan is running. You can keep using the dashboard while it works.";
  }
  if (latestStatus) {
    return "Open tasks are only mail that still needs a next step. The summary is everything else that arrived.";
  }
  return "Gmail is connected. Choose a lookback (up to a month) and run a scan.";
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ gmail?: string; reason?: string; scan?: string }>;
}) {
  const user = await getSessionUser();
  if (!user) {
    redirect("/login");
  }

  const [params, gmailStatus] = await Promise.all([searchParams, getGmailStatusForUser(user.id)]);
  const connected = gmailStatus.connection?.status === "CONNECTED";
  const emptyCounts = { processed: 0, important: 0, needAction: 0, waiting: 0 };
  const [counts, latestScan, openActions, waitingActions, recentThreads] = connected
    ? await Promise.all([
        getInboxCountsForUser(user.id),
        getLatestScanRunForUser(user.id),
        listActionsForUser(user.id, "OPEN", 24),
        listActionsForUser(user.id, "WAITING", 8),
        listRecentThreadsForUser(user.id, 24),
      ])
    : [emptyCounts, null, [], [], []];
  const latestStatus = latestScan ? String(latestScan.status) : null;

  const stats = [
    { label: "Processed", value: connected ? String(counts.processed) : "—", icon: Inbox },
    { label: "Important", value: connected ? String(counts.important) : "—", icon: ShieldAlert },
    { label: "Open tasks", value: connected ? String(openActions.length) : "—", icon: ListChecks },
    { label: "Waiting", value: connected ? String(counts.waiting) : "—", icon: Clock3 },
  ];

  return (
    <AppShell header={<AppHeader email={user.email} current="dashboard" />}>
      <PageHeader
        title="Inbox overview"
        description={dashboardDescription({
          connected,
          scanDone: params.scan === "done",
          latestStatus,
        })}
      />

      {!connected || params.gmail ? (
        <GmailConnectionCard status={gmailStatus} gmailFlash={params.gmail} reason={params.reason} />
      ) : null}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
        {stats.map((stat) => (
          <Card key={stat.label} size="sm">
            <CardContent className="pt-1">
              <stat.icon className="text-muted-foreground mb-2 size-4" aria-hidden />
              <div className="text-3xl font-semibold tracking-tight tabular-nums">{stat.value}</div>
              <div className="text-muted-foreground mt-1 text-sm">{stat.label}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Latest scan</CardTitle>
            <CardDescription>
              {latestScan
                ? latestStatus === "RUNNING"
                  ? "Checking conversations in the background."
                  : `Status: ${labelForScanStatus(latestStatus)}.`
                : "No scan yet."}
            </CardDescription>
          </CardHeader>
          <CardContent className="text-sm leading-relaxed">
            {latestScan ? (
              <dl className="text-muted-foreground grid gap-2 sm:grid-cols-2">
                <div>
                  <dt className="text-foreground font-medium">Last run</dt>
                  <dd>
                    {latestStatus === "RUNNING"
                      ? "In progress"
                      : formatDateTime(latestScan.finished_at as string | null)}
                  </dd>
                </div>
                <div>
                  <dt className="text-foreground font-medium">Progress</dt>
                  <dd>
                    {latestStatus === "RUNNING"
                      ? `${Number(latestScan.threads_checked ?? 0)} of ${Number(latestScan.threads_discovered ?? 0)} conversations`
                      : `${latestScan.messages_processed} emails processed`}
                  </dd>
                </div>
                <div className="sm:col-span-2">
                  <dt className="text-foreground font-medium">Next scan</dt>
                  <dd>{formatDateTime(gmailStatus.connection?.nextScanAt)}</dd>
                </div>
              </dl>
            ) : (
              <p className="text-muted-foreground">Run an initial scan to classify the last days of mail.</p>
            )}
          </CardContent>
        </Card>
        <InitialScanCard
          connected={connected}
          incremental={Boolean(gmailStatus.connection?.lastSuccessfulScanAt)}
          latestScan={
            latestScan
              ? {
                  id: String(latestScan.id),
                  status: String(latestScan.status),
                  threads_discovered: Number(latestScan.threads_discovered ?? 0),
                  threads_checked: Number(latestScan.threads_checked ?? 0),
                }
              : null
          }
        />
      </div>

      <CollapsibleBlock
        storageKey="dashboard-open-tasks"
        title="Open tasks"
        description="Mail that still needs a next step, grouped by topic."
        action={
          <Link href="/actions?tab=OPEN" className="text-primary shrink-0 pt-2 text-sm font-medium hover:underline">
            View all
          </Link>
        }
      >
        <GroupedActionList items={openActions} storageKey="open-tasks" />
      </CollapsibleBlock>

      <CollapsibleBlock
        storageKey="dashboard-waiting"
        title="Waiting"
        description="You already acted. The ball is in someone else's court."
        action={
          <Link href="/actions?tab=WAITING" className="text-primary shrink-0 pt-2 text-sm font-medium hover:underline">
            View all
          </Link>
        }
      >
        <GroupedActionList
          items={waitingActions}
          storageKey="waiting"
          emptyTitle="Nothing waiting"
          emptyDescription="Threads you replied to or submitted will land here."
        />
      </CollapsibleBlock>

      <CollapsibleBlock
        storageKey="dashboard-inbox-summary"
        title="Inbox summary"
        description="What the mail is about, including FYI notices. These are not open tasks."
      >
        <InboxSummary threads={recentThreads} />
      </CollapsibleBlock>
    </AppShell>
  );
}
