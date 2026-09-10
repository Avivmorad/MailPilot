import { redirect } from "next/navigation";

import { GroupedActionList } from "@/components/actions/grouped-action-list";
import { ActionItemCard } from "@/components/actions/action-item-card";
import { GmailConnectionCard } from "@/components/gmail/gmail-connection-card";
import { AppHeader } from "@/components/nav/app-header";
import { InitialScanCard } from "@/components/scans/initial-scan-card";
import { InboxSummary } from "@/components/threads/inbox-summary";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { listActionsForUser } from "@/lib/actions/queries";
import { getGmailStatusForUser } from "@/lib/gmail/connections";
import { getInboxCountsForUser, getLatestScanRunForUser } from "@/lib/scans/manual";
import { getSessionUser } from "@/lib/supabase/auth";
import { listRecentThreadsForUser } from "@/lib/threads/queries";
import { formatDateTime } from "@/lib/ui/format";

export const dynamic = "force-dynamic";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ gmail?: string; reason?: string; scan?: string }>;
}) {
  const user = await getSessionUser();
  if (!user) {
    redirect("/login");
  }

  const params = await searchParams;
  const gmailStatus = await getGmailStatusForUser(user.id);
  const connected = gmailStatus.connection?.status === "CONNECTED";
  const counts = connected
    ? await getInboxCountsForUser(user.id)
    : { processed: 0, important: 0, needAction: 0, waiting: 0 };
  const latestScan = connected ? await getLatestScanRunForUser(user.id) : null;
  const openActions = connected ? await listActionsForUser(user.id, "OPEN", 24) : [];
  const waitingActions = connected ? await listActionsForUser(user.id, "WAITING", 8) : [];
  const recentThreads = connected ? await listRecentThreadsForUser(user.id, 24) : [];

  const stats = [
    { label: "Processed", value: connected ? String(counts.processed) : "—" },
    { label: "Important", value: connected ? String(counts.important) : "—" },
    { label: "Open tasks", value: connected ? String(openActions.length) : "—" },
    { label: "Waiting", value: connected ? String(counts.waiting) : "—" },
  ];

  return (
    <div className="flex min-h-full flex-col">
      <AppHeader email={user.email} current="dashboard" />

      <main className="mx-auto w-full max-w-6xl flex-1 space-y-8 px-6 py-10">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Inbox overview</h1>
          <p className="text-muted-foreground mt-1">
            {connected
              ? params.scan === "done"
                ? "Scan finished. Counts below are from the database."
                : latestScan
                  ? `Last scan: ${String(latestScan.status).toLowerCase()}.`
                  : "Gmail is connected. Choose a lookback (up to a month) and run a scan."
              : "Connect Gmail to start triaging your inbox."}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {stats.map((stat) => (
            <Card key={stat.label}>
              <CardContent className="pt-6">
                <div className="text-3xl font-semibold tabular-nums">{stat.value}</div>
                <div className="text-muted-foreground mt-1 text-sm">{stat.label}</div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Latest scan</CardTitle>
            </CardHeader>
            <CardContent className="text-sm">
              {latestScan ? (
                <ul className="text-muted-foreground space-y-1">
                  <li>
                    Last scan:{" "}
                    {String(latestScan.status) === "RUNNING"
                      ? "in progress"
                      : formatDateTime(latestScan.finished_at as string | null)}
                  </li>
                  <li>
                    {String(latestScan.status) === "RUNNING"
                      ? `${Number(latestScan.threads_checked ?? 0)} of ${Number(latestScan.threads_discovered ?? 0)} conversations checked`
                      : `${latestScan.messages_processed} emails processed`}
                  </li>
                  <li>Status: {String(latestScan.status)}</li>
                  <li>Next scan: {formatDateTime(gmailStatus.connection?.nextScanAt)}</li>
                </ul>
              ) : (
                <p className="text-muted-foreground">No scan yet.</p>
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

        <section className="space-y-3">
          <div className="flex items-baseline justify-between gap-4">
            <div>
              <h2 className="text-lg font-medium">Open tasks</h2>
              <p className="text-muted-foreground text-sm">
                Only mail that still needs a real next step — grouped by topic. Not the inbox summary.
              </p>
            </div>
            <a href="/actions?tab=OPEN" className="text-muted-foreground shrink-0 text-sm hover:underline">
              View all
            </a>
          </div>
          <GroupedActionList items={openActions} />
        </section>

        <section className="space-y-3">
          <div className="flex items-baseline justify-between">
            <h2 className="text-lg font-medium">Waiting</h2>
            <a href="/actions?tab=WAITING" className="text-muted-foreground text-sm hover:underline">
              View all
            </a>
          </div>
          {waitingActions.length === 0 ? (
            <p className="text-muted-foreground text-sm">Nothing waiting on others.</p>
          ) : (
            <div className="space-y-3">
              {waitingActions.map((item) => (
                <ActionItemCard key={item.id} item={item} />
              ))}
            </div>
          )}
        </section>

        <section className="space-y-3">
          <div>
            <h2 className="text-lg font-medium">Inbox summary</h2>
            <p className="text-muted-foreground text-sm">
              What the mail is about, including FYI notices (security check-ins, receipts). These are
              not open tasks.
            </p>
          </div>
          <InboxSummary threads={recentThreads} />
        </section>

        <GmailConnectionCard status={gmailStatus} gmailFlash={params.gmail} reason={params.reason} />
      </main>
    </div>
  );
}
