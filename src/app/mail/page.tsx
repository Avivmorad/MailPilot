import Link from "next/link";
import { redirect } from "next/navigation";

import { GroupedActionList } from "@/components/actions/grouped-action-list";
import { AppChrome } from "@/components/layout/app-chrome";
import { EmptyState } from "@/components/layout/empty-state";
import { PageHeader } from "@/components/layout/page-header";
import { InboxSummary } from "@/components/threads/inbox-summary";
import { buttonVariants } from "@/components/ui/button";
import { listActionsForUser } from "@/lib/actions/queries";
import { getGmailStatusForUser } from "@/lib/gmail/connections";
import { gmailRecoveryActionLabel, shouldShowGmailRecoveryCard } from "@/lib/gmail/recovery";
import {
  isStaleWaiting,
  isUncertainClassification,
  parseUncertainFilter,
} from "@/lib/mail/filters";
import { actionStatusForMailTab, MAIL_TABS, mailTabEmptyCopy, parseMailTab } from "@/lib/mail/tabs";
import { getSessionUser } from "@/lib/supabase/auth";
import { listIgnoredThreadsForUser, listRecentThreadsForUser } from "@/lib/threads/queries";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

function tabDescription(tab: ReturnType<typeof parseMailTab>): string {
  switch (tab) {
    case "summary":
      return "Leftover useful FYI only. Receipts, OTPs, and marketing live in Ignored. Security events live in Open.";
    case "open":
      return "Mail that still needs a next step, grouped by category.";
    case "waiting":
      return "You already acted. The ball is in someone else's court.";
    case "completed":
      return "Tasks you marked complete.";
    case "snoozed":
      return "Tasks you postponed. They return to Open when the snooze ends.";
    case "ignored":
      return "Threads classified as ignore — noise, OTPs, and mail that is not a task.";
  }
}

export default async function MailPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; uncertain?: string }>;
}) {
  const user = await getSessionUser();
  if (!user) {
    redirect("/login");
  }
  const params = await searchParams;
  const tab = parseMailTab(params.tab);
  const uncertainOnly = parseUncertainFilter(params.uncertain);
  const actionStatus = actionStatusForMailTab(tab);
  const empty = mailTabEmptyCopy(tab);

  let queryError = false;

  const [actionItems, summaryThreads, ignoredThreads, gmailStatus] = await Promise.all([
    actionStatus
      ? listActionsForUser(user.id, actionStatus).catch(() => {
          queryError = true;
          return [];
        })
      : Promise.resolve([]),
    tab === "summary"
      ? listRecentThreadsForUser(user.id, 50).catch(() => {
          queryError = true;
          return [];
        })
      : Promise.resolve([]),
    tab === "ignored"
      ? listIgnoredThreadsForUser(user.id, 50).catch(() => {
          queryError = true;
          return [];
        })
      : Promise.resolve([]),
    getGmailStatusForUser(user.id),
  ]);
  const uncertainCount = actionItems.filter((item) =>
    isUncertainClassification(item.confidence),
  ).length;
  const visibleItems =
    uncertainOnly && actionStatus
      ? actionItems.filter((item) => isUncertainClassification(item.confidence))
      : actionItems;
  const staleWaitingCount =
    tab === "waiting" ? actionItems.filter((item) => isStaleWaiting(item.updatedAt)).length : 0;
  const needsGmailRecovery = shouldShowGmailRecoveryCard(gmailStatus);
  const emptyAction = needsGmailRecovery ? (
    <a href="/api/gmail/connect" className={buttonVariants({ size: "sm" })}>
      {gmailRecoveryActionLabel(gmailStatus)}
    </a>
  ) : (
    <Link href="/dashboard#scan" className={buttonVariants({ size: "sm" })}>
      Scan now
    </Link>
  );

  return (
    <AppChrome user={user} current="mail">
      <PageHeader title="Mail" description={tabDescription(tab)} />
      <nav aria-label="Mail views" className="bg-muted/70 flex flex-wrap gap-1 rounded-xl p-1">
        {MAIL_TABS.map((item) => (
          <Link
            key={item.id}
            href={`/mail?tab=${item.id}`}
            aria-current={tab === item.id ? "page" : undefined}
            className={cn(
              "focus-visible:ring-ring inline-flex min-h-10 items-center rounded-lg px-3 py-1.5 text-sm transition-colors focus-visible:ring-3 focus-visible:outline-none",
              tab === item.id
                ? "bg-background text-foreground font-medium shadow-xs"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {item.label}
          </Link>
        ))}
      </nav>
      {queryError ? (
        <EmptyState
          variant="error"
          title={`Could not load ${tab === "open" ? "open tasks" : tab === "waiting" ? "waiting tasks" : tab === "summary" ? "summary threads" : tab === "ignored" ? "ignored mail" : "tasks"}`}
          description="We had trouble reaching the database. Reload to try again. Your mailbox data is safe."
          action={
            <Link
              href={`/mail?tab=${tab}`}
              className={buttonVariants({ size: "sm", variant: "outline" })}
            >
              Reload view
            </Link>
          }
        />
      ) : (
        <>
          {actionStatus && (uncertainCount > 0 || uncertainOnly) ? (
            <p className="text-muted-foreground text-sm">
              {uncertainOnly ? (
                <>
                  Showing {visibleItems.length} uncertain{" "}
                  {visibleItems.length === 1 ? "classification" : "classifications"}.{" "}
                  <Link
                    href={`/mail?tab=${tab}`}
                    className="text-primary font-medium hover:underline"
                  >
                    Show all
                  </Link>
                </>
              ) : (
                <>
                  {uncertainCount} classification{uncertainCount === 1 ? " is" : "s are"} uncertain.{" "}
                  <Link
                    href={`/mail?tab=${tab}&uncertain=1`}
                    className="text-primary font-medium hover:underline"
                  >
                    Show uncertain only
                  </Link>
                </>
              )}
            </p>
          ) : null}
          {staleWaitingCount > 0 ? (
            <p className="text-muted-foreground text-sm">
              {staleWaitingCount} waiting item{staleWaitingCount === 1 ? " has" : "s have"} been
              quiet for a week or more.
            </p>
          ) : null}
          {tab === "summary" ? (
            <InboxSummary
              threads={summaryThreads}
              storageKey="mail-summary"
              emptyTitle={empty.title}
              emptyDescription={empty.description}
              emptyAction={emptyAction}
            />
          ) : null}
          {tab === "ignored" ? (
            <InboxSummary
              threads={ignoredThreads}
              storageKey="mail-ignored"
              emptyTitle={empty.title}
              emptyDescription={empty.description}
              emptyAction={emptyAction}
            />
          ) : null}
          {actionStatus ? (
            <GroupedActionList
              items={visibleItems}
              storageKey={`mail-${tab}${uncertainOnly ? "-uncertain" : ""}`}
              emptyTitle={
                uncertainOnly ? "No uncertain classifications in this view." : empty.title
              }
              emptyDescription={
                uncertainOnly
                  ? "Threads the classifier is unsure about would appear here so you can double-check them."
                  : empty.description
              }
              emptyAction={emptyAction}
            />
          ) : null}
        </>
      )}
    </AppChrome>
  );
}
