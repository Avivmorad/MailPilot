import Link from "next/link";
import { redirect } from "next/navigation";

import { GroupedActionList } from "@/components/actions/grouped-action-list";
import { AppChrome } from "@/components/layout/app-chrome";
import { PageHeader } from "@/components/layout/page-header";
import { InboxSummary } from "@/components/threads/inbox-summary";
import { buttonVariants } from "@/components/ui/button";
import { listActionsForUser } from "@/lib/actions/queries";
import { getGmailStatusForUser } from "@/lib/gmail/connections";
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
      return "Mail that still needs a next step, grouped by Security, Payments, and General.";
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
  searchParams: Promise<{ tab?: string }>;
}) {
  const user = await getSessionUser();
  if (!user) {
    redirect("/login");
  }
  const params = await searchParams;
  const tab = parseMailTab(params.tab);
  const actionStatus = actionStatusForMailTab(tab);
  const empty = mailTabEmptyCopy(tab);

  const [actionItems, summaryThreads, ignoredThreads, gmailStatus] = await Promise.all([
    actionStatus ? listActionsForUser(user.id, actionStatus) : Promise.resolve([]),
    tab === "summary" ? listRecentThreadsForUser(user.id, 50) : Promise.resolve([]),
    tab === "ignored" ? listIgnoredThreadsForUser(user.id, 50) : Promise.resolve([]),
    getGmailStatusForUser(user.id),
  ]);
  const connected = gmailStatus.connection?.status === "CONNECTED";
  const emptyAction = connected ? (
    <Link href="/dashboard#scan" className={buttonVariants({ size: "sm" })}>
      Scan now
    </Link>
  ) : (
    <a href="/api/gmail/connect" className={buttonVariants({ size: "sm" })}>
      Connect Gmail
    </a>
  );

  return (
    <AppChrome user={user} current="mail">
      <PageHeader title="Mail" description={tabDescription(tab)} />
      <div className="bg-muted/70 flex flex-wrap gap-1 rounded-xl p-1">
        {MAIL_TABS.map((item) => (
          <Link
            key={item.id}
            href={`/mail?tab=${item.id}`}
            aria-current={tab === item.id ? "page" : undefined}
            className={cn(
              "rounded-lg px-3 py-1.5 text-sm transition-colors",
              tab === item.id
                ? "bg-background text-foreground font-medium shadow-xs"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {item.label}
          </Link>
        ))}
      </div>
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
          items={actionItems}
          storageKey={`mail-${tab}`}
          emptyTitle={empty.title}
          emptyDescription={empty.description}
          emptyAction={emptyAction}
        />
      ) : null}
    </AppChrome>
  );
}
