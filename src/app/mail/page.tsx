import Link from "next/link";
import { redirect } from "next/navigation";

import { GroupedActionList } from "@/components/actions/grouped-action-list";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { AppHeader } from "@/components/nav/app-header";
import { InboxSummary } from "@/components/threads/inbox-summary";
import { listActionsForUser } from "@/lib/actions/queries";
import { actionStatusForMailTab, MAIL_TABS, parseMailTab } from "@/lib/mail/tabs";
import { getSessionUser } from "@/lib/supabase/auth";
import { listIgnoredThreadsForUser, listRecentThreadsForUser } from "@/lib/threads/queries";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

function tabDescription(tab: ReturnType<typeof parseMailTab>): string {
  switch (tab) {
    case "summary":
      return "Quick updates only — FYI notices, receipts, and other mail that needs no action. Ignored noise lives in Ignored.";
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

  const actionItems = actionStatus ? await listActionsForUser(user.id, actionStatus) : [];
  const summaryThreads = tab === "summary" ? await listRecentThreadsForUser(user.id, 50) : [];
  const ignoredThreads = tab === "ignored" ? await listIgnoredThreadsForUser(user.id, 50) : [];

  return (
    <AppShell header={<AppHeader email={user.email} current="mail" />} width="narrow">
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
        <InboxSummary threads={summaryThreads} storageKey="mail-summary" />
      ) : null}
      {tab === "ignored" ? (
        <InboxSummary
          threads={ignoredThreads}
          storageKey="mail-ignored"
          emptyTitle="Nothing ignored"
          emptyDescription="OTP notices and other ignore-classified mail will appear here after a scan."
        />
      ) : null}
      {actionStatus ? (
        <GroupedActionList
          items={actionItems}
          storageKey={`mail-${tab}`}
          emptyTitle="Nothing in this list yet"
          emptyDescription="Run a scan from the dashboard, then come back to work through mail."
        />
      ) : null}
    </AppShell>
  );
}
