import { Ban, Clock3, Inbox, ListChecks, ShieldAlert } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { GmailConnectionCard } from "@/components/gmail/gmail-connection-card";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { AppHeader } from "@/components/nav/app-header";
import { InitialScanCard } from "@/components/scans/initial-scan-card";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { countActionsForUser } from "@/lib/actions/queries";
import { getGmailStatusForUser } from "@/lib/gmail/connections";
import { MAIL_TABS } from "@/lib/mail/tabs";
import { getInboxCountsForUser, getLatestScanRunForUser } from "@/lib/scans/manual";
import { getSessionUser } from "@/lib/supabase/auth";
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
    return "Overview of scan status and counts. Open, waiting, and digest lists live under Mail.";
  }
  return "Gmail is connected. Choose a lookback (up to a month) and run a scan.";
}

function nextStepCopy({
  connected,
  openCount,
  processed,
}: {
  connected: boolean;
  openCount: number;
  processed: number;
}): string {
  if (!connected) {
    return "Connect Gmail in Settings or with the card above, then run your first scan.";
  }
  if (processed === 0) {
    return "Run Scan now to classify recent mail. Lists will appear under Mail.";
  }
  if (openCount > 0) {
    return `You have ${openCount} open task${openCount === 1 ? "" : "s"}. Open Mail to work through them.`;
  }
  return "No open tasks. Check the Mail summary for FYI mail, or Waiting if you already acted.";
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
  const emptyCounts = { processed: 0, important: 0, needAction: 0, waiting: 0, ignored: 0 };
  const [counts, latestScan, openCount] = connected
    ? await Promise.all([
        getInboxCountsForUser(user.id),
        getLatestScanRunForUser(user.id),
        countActionsForUser(user.id, "OPEN"),
      ])
    : [emptyCounts, null, 0];
  const latestStatus = latestScan ? String(latestScan.status) : null;
  const showGmailCard = !connected || Boolean(params.gmail);

  const stats = [
    { label: "Processed", value: connected ? String(counts.processed) : "—", icon: Inbox, href: "/mail?tab=summary" },
    { label: "Important", value: connected ? String(counts.important) : "—", icon: ShieldAlert, href: "/mail?tab=summary" },
    { label: "Open", value: connected ? String(openCount) : "—", icon: ListChecks, href: "/mail?tab=open" },
    { label: "Waiting", value: connected ? String(counts.waiting) : "—", icon: Clock3, href: "/mail?tab=waiting" },
    { label: "Ignored", value: connected ? String(counts.ignored) : "—", icon: Ban, href: "/mail?tab=ignored" },
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

      {showGmailCard ? (
        <GmailConnectionCard status={gmailStatus} gmailFlash={params.gmail} reason={params.reason} />
      ) : (
        <p className="text-muted-foreground text-sm">
          Gmail connected as{" "}
          <span className="text-foreground font-medium">{gmailStatus.connection?.gmailEmail}</span>
          {" · "}
          <Link href="/settings" className="text-primary font-medium hover:underline">
            Manage in Settings
          </Link>
        </p>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5 sm:gap-4">
        {stats.map((stat) => (
          <Link key={stat.label} href={stat.href} className="block rounded-xl focus-visible:ring-2 focus-visible:ring-offset-2">
            <Card size="sm" className="h-full transition-colors hover:bg-muted/40">
              <CardContent className="pt-1">
                <stat.icon className="text-muted-foreground mb-2 size-4" aria-hidden />
                <div className="text-3xl font-semibold tracking-tight tabular-nums">{stat.value}</div>
                <div className="text-muted-foreground mt-1 text-sm">{stat.label}</div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <p className="text-sm leading-relaxed">{nextStepCopy({ connected, openCount, processed: counts.processed })}</p>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
        <span className="text-muted-foreground">Mail lists</span>
        {MAIL_TABS.map((item) => (
          <Link
            key={item.id}
            href={`/mail?tab=${item.id}`}
            className="text-primary font-medium hover:underline"
          >
            {item.label}
          </Link>
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
    </AppShell>
  );
}
