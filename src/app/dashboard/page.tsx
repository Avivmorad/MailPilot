import { Clock3, Inbox, ListChecks } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { ActionItemCard } from "@/components/actions/action-item-card";
import { DigestReportCard } from "@/components/digest/digest-report-card";
import { GmailConnectionCard } from "@/components/gmail/gmail-connection-card";
import { AppChrome } from "@/components/layout/app-chrome";
import { EmptyState } from "@/components/layout/empty-state";
import { PageHeader } from "@/components/layout/page-header";
import { InitialScanCard } from "@/components/scans/initial-scan-card";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { listActionsForUser, type ActionListItem } from "@/lib/actions/queries";
import { getDashboardChangesForUser } from "@/lib/dashboard/queries";
import { ensureDigestForLatestScan } from "@/lib/digest/build-digest";
import { getGmailStatusForUser } from "@/lib/gmail/connections";
import { shouldShowGmailRecoveryCard } from "@/lib/gmail/recovery";
import { getOnboardingStepForUser } from "@/lib/onboarding/load";
import { getInboxCountsForUser, getLatestScanRunForUser } from "@/lib/scans/manual";
import { getSessionUser } from "@/lib/supabase/auth";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const ATTENTION_PREVIEW = 3;

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
    return "Scan finished. New and overdue work is first — FYI and waiting stay in Mail.";
  }
  if (latestStatus === "PARTIAL") {
    return "Last scan finished with some threads still pending. New and overdue work is listed first.";
  }
  if (latestStatus === "RUNNING") {
    return "A scan is running. You can keep working while it classifies mail.";
  }
  return "What needs you, what you are waiting for, and what happened.";
}

function nextStep({
  connected,
  openCount,
  processed,
  scanRunning,
}: {
  connected: boolean;
  openCount: number;
  processed: number;
  scanRunning: boolean;
}): { title: string; body: string; href: string; label: string } | null {
  if (!connected) {
    return null;
  }
  if (scanRunning) {
    return {
      title: "Scan in progress",
      body: "Progress is on the scan panel below. Mail lists update as threads finish.",
      href: "#scan",
      label: "View scan",
    };
  }
  if (processed === 0) {
    return {
      title: "Run your first scan",
      body: "Choose a lookback window and classify recent mail. Open tasks will land here.",
      href: "#scan",
      label: "Scan now",
    };
  }
  if (openCount > 0) {
    return {
      title: `${openCount} open task${openCount === 1 ? "" : "s"}`,
      body: "Work through Needs your attention, or open the full list in Mail.",
      href: "/mail?tab=open",
      label: "Work through them",
    };
  }
  return {
    title: "Inbox is clear",
    body: "No open tasks. Check Mail summary for leftover FYI, or Waiting if you already acted.",
    href: "/mail?tab=summary",
    label: "Open Mail summary",
  };
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

  const onboardingStep = await getOnboardingStepForUser(user.id);
  if (onboardingStep !== "complete") {
    const next = new URLSearchParams();
    const pending = await searchParams;
    if (pending.gmail) {
      next.set("gmail", pending.gmail);
    }
    if (pending.reason) {
      next.set("reason", pending.reason);
    }
    const query = next.toString();
    redirect(query ? `/onboarding?${query}` : "/onboarding");
  }

  const [params, gmailStatus] = await Promise.all([searchParams, getGmailStatusForUser(user.id)]);
  const connected = gmailStatus.connection?.status === "CONNECTED";
  const showGmailCard = Boolean(params.gmail) || shouldShowGmailRecoveryCard(gmailStatus);
  const emptyCounts = { processed: 0, important: 0, needAction: 0, waiting: 0, ignored: 0, fyi: 0 };
  const latestScan = connected ? await getLatestScanRunForUser(user.id) : null;
  const since = gmailStatus.connection?.lastSuccessfulScanAt ?? null;
  let actionsLoadError = false;
  let countsLoadError = false;

  const [counts, openActions, latestDigest, dashboardChanges] = connected
    ? await Promise.all([
        getInboxCountsForUser(user.id).catch(() => {
          countsLoadError = true;
          return emptyCounts;
        }),
        listActionsForUser(user.id, "OPEN").catch(() => {
          actionsLoadError = true;
          return [] as ActionListItem[];
        }),
        ensureDigestForLatestScan(
          user.id,
          latestScan ? String(latestScan.id) : null,
          latestScan ? String(latestScan.status) : null,
        ).catch(() => null),
        getDashboardChangesForUser(user.id, since).catch(() => ({
          summary: {
            since: null,
            newOpen: 0,
            completed: 0,
            reopened: 0,
            staleWaiting: 0,
            overdueOpen: 0,
          },
          line: null,
        })),
      ])
    : [
        emptyCounts,
        [],
        null,
        {
          summary: {
            since: null,
            newOpen: 0,
            completed: 0,
            reopened: 0,
            staleWaiting: 0,
            overdueOpen: 0,
          },
          line: null,
        },
      ];
  const latestStatus = latestScan ? String(latestScan.status) : null;
  const openCount = openActions.length;
  const attentionItems = openActions.slice(0, ATTENTION_PREVIEW);
  const changeLine = dashboardChanges.line;
  const overdueOpen = dashboardChanges.summary.overdueOpen;

  const step = countsLoadError
    ? null
    : nextStep({
        connected,
        openCount,
        processed: counts.processed,
        scanRunning: latestStatus === "RUNNING",
      });
  const stats = [
    {
      label: "Open tasks",
      value: connected && !actionsLoadError ? String(openCount) : "—",
      href: "/mail?tab=open",
      icon: ListChecks,
      hero: true,
    },
    {
      label: "Waiting",
      value: connected && !countsLoadError ? String(counts.waiting) : "—",
      href: "/mail?tab=waiting",
      icon: Clock3,
      hero: false,
    },
    {
      label: "FYI",
      value: connected && !countsLoadError ? String(counts.fyi) : "—",
      href: "/mail?tab=summary",
      icon: Inbox,
      hero: false,
    },
  ];

  return (
    <AppChrome user={user} current="dashboard">
      <PageHeader
        title="Inbox overview"
        description={dashboardDescription({
          connected,
          scanDone: params.scan === "done",
          latestStatus,
        })}
      />

      {showGmailCard ? (
        <GmailConnectionCard
          status={gmailStatus}
          gmailFlash={params.gmail}
          reason={params.reason}
        />
      ) : null}

      {step ? (
        <div className="bg-card ring-foreground/10 flex flex-wrap items-center justify-between gap-3 rounded-xl px-4 py-3 ring-1">
          <div className="min-w-0">
            <p className="font-medium tracking-tight">{step.title}</p>
            <p className="text-muted-foreground mt-0.5 text-sm leading-relaxed">{step.body}</p>
            {changeLine ? (
              <p className="text-muted-foreground mt-1 text-sm leading-relaxed">{changeLine}</p>
            ) : null}
          </div>
          <Link href={step.href} className={buttonVariants()}>
            {step.label}
          </Link>
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {stats.map((stat) => (
          <Link
            key={stat.label}
            href={stat.href}
            className="block rounded-xl focus-visible:ring-2 focus-visible:ring-offset-2"
          >
            <Card
              size={stat.hero ? "default" : "sm"}
              className="hover:bg-muted/40 h-full transition-colors"
            >
              <CardContent className={cn(stat.hero ? "pt-1" : "")}>
                <stat.icon className="text-muted-foreground mb-2 size-4" aria-hidden />
                <div
                  className={cn(
                    "font-semibold tracking-tight tabular-nums",
                    stat.hero ? "text-4xl" : "text-3xl",
                  )}
                >
                  {stat.value}
                </div>
                <div className="text-muted-foreground mt-1 text-sm">{stat.label}</div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <section className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="text-foreground text-lg font-semibold tracking-tight">
              Needs your attention
            </h2>
            <p className="text-muted-foreground text-sm">
              {overdueOpen > 0
                ? "Overdue and urgent first. Full list lives in Mail."
                : "Top open tasks. Full list lives in Mail."}
            </p>
          </div>
          {openCount > 0 ? (
            <Link
              href="/mail?tab=open"
              className="text-primary text-sm font-medium hover:underline"
            >
              View all in Mail
            </Link>
          ) : null}
        </div>
        {actionsLoadError ? (
          <EmptyState
            variant="error"
            title="Could not load open tasks"
            description="We had trouble reaching the database. Reload to try again. Your mailbox data is safe."
            action={
              <Link
                href="/dashboard"
                className={buttonVariants({ size: "sm", variant: "outline" })}
              >
                Reload
              </Link>
            }
          />
        ) : attentionItems.length > 0 ? (
          <div className="space-y-3">
            {attentionItems.map((item) => (
              <ActionItemCard key={item.id} item={item} />
            ))}
          </div>
        ) : (
          <EmptyState
            title="Nothing currently needs your action."
            description={
              connected
                ? "When a thread still needs a next step, it will show up here."
                : "Connect Gmail to start organizing your inbox."
            }
            action={
              connected ? (
                <Link href="#scan" className={buttonVariants({ size: "sm" })}>
                  Scan now
                </Link>
              ) : (
                <a href="/api/gmail/connect" className={buttonVariants({ size: "sm" })}>
                  Connect Gmail
                </a>
              )
            }
          />
        )}
      </section>

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
                error_code: (latestScan.error_code as string | null | undefined) ?? null,
                error_message: (latestScan.error_message as string | null | undefined) ?? null,
              }
            : null
        }
        lastRunAt={
          latestStatus === "RUNNING"
            ? null
            : ((latestScan?.finished_at as string | null | undefined) ?? null)
        }
        lastRunStatus={latestStatus === "RUNNING" ? null : latestStatus}
        messagesProcessed={
          latestScan && latestStatus !== "RUNNING"
            ? Number(latestScan.messages_processed ?? 0)
            : null
        }
        nextScanAt={gmailStatus.connection?.nextScanAt}
      />

      <DigestReportCard digest={latestDigest} variant="compact" />

      {connected && gmailStatus.connection?.gmailEmail ? (
        <p className="text-muted-foreground text-sm">
          Gmail connected as{" "}
          <span className="text-foreground font-medium">{gmailStatus.connection.gmailEmail}</span>
          {" · "}
          <Link href="/settings" className="text-primary font-medium hover:underline">
            Manage in Settings
          </Link>
        </p>
      ) : null}
    </AppChrome>
  );
}
