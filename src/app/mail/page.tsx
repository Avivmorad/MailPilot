import Link from "next/link";
import { redirect } from "next/navigation";

import { GroupedActionList } from "@/components/actions/grouped-action-list";
import { AppChrome } from "@/components/layout/app-chrome";
import { EmptyState } from "@/components/layout/empty-state";
import { PageHeader } from "@/components/layout/page-header";
import { MailCategoryFilters } from "@/components/mail/category-filters";
import { InboxSummary } from "@/components/threads/inbox-summary";
import { buttonVariants } from "@/components/ui/button";
import { listActionsForUser, type ActionListItem } from "@/lib/actions/queries";
import { CATEGORY_LABELS, normalizeCategory } from "@/lib/ai/categories";
import { getGmailStatusForUser } from "@/lib/gmail/connections";
import { gmailRecoveryActionLabel, shouldShowGmailRecoveryCard } from "@/lib/gmail/recovery";
import {
  categoryFilterCounts,
  filterByCategory,
  isStaleWaiting,
  isUncertainClassification,
  parseCategoryFilter,
  parseUncertainFilter,
} from "@/lib/mail/filters";
import { getMailFigures, type MailFigures } from "@/lib/mail/figures";
import {
  actionStatusForMailTab,
  MAIL_TABS,
  mailTabEmptyCopy,
  mailViewPath,
  parseMailTab,
  type MailTab,
} from "@/lib/mail/tabs";
import { getSessionUser } from "@/lib/supabase/auth";
import { requireOnboardingComplete } from "@/lib/onboarding/guard";
import {
  listIgnoredThreadsForUser,
  listRecentThreadsForUser,
  type RecentThreadRow,
} from "@/lib/threads/queries";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const MAIL_SECTION_GROUPS = [
  {
    label: "Work",
    items: [
      { id: "summary", hint: "Useful updates" },
      { id: "open", hint: "Needs a next step" },
      { id: "waiting", hint: "Waiting on someone else" },
    ],
  },
  {
    label: "Record",
    items: [
      { id: "completed", hint: "Tasks you finished" },
      { id: "snoozed", hint: "Postponed" },
      { id: "ignored", hint: "Noise and OTPs" },
    ],
  },
] as const;

function sectionCount(tab: MailTab, figures: MailFigures | null): string {
  if (!figures) {
    return "—";
  }
  switch (tab) {
    case "summary":
      return String(figures.forYou);
    case "open":
      return String(figures.actions);
    case "waiting":
      return String(figures.pending);
    case "completed":
      return String(figures.closed);
    case "snoozed":
      return String(figures.snoozed);
    case "ignored":
      return String(figures.ignored);
  }
}

function tabDescription(tab: ReturnType<typeof parseMailTab>): string {
  switch (tab) {
    case "summary":
      return "Useful updates only. Receipts, OTPs, and marketing live in Ignored. Security events live in Actions.";
    case "open":
      return "Mail that still needs a next step, grouped by category.";
    case "waiting":
      return "You already acted. The ball is in someone else's court.";
    case "completed":
      return "Tasks you marked closed.";
    case "snoozed":
      return "Tasks you postponed. They return to Actions when the snooze ends.";
    case "ignored":
      return "Threads classified as ignore — noise, OTPs, and mail that is not a task.";
  }
}

export default async function MailPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; uncertain?: string; category?: string }>;
}) {
  const user = await getSessionUser();
  if (!user) {
    redirect("/login");
  }
  await requireOnboardingComplete(user.id);
  const params = await searchParams;
  const tab = parseMailTab(params.tab);
  const uncertainOnly = parseUncertainFilter(params.uncertain);
  const category = parseCategoryFilter(params.category);
  const actionStatus = actionStatusForMailTab(tab);
  const empty = mailTabEmptyCopy(tab);

  let queryError = false;

  const [actionItems, summaryThreads, ignoredThreads, gmailStatus, figures] = await Promise.all([
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
    getMailFigures(user.id).catch(() => null),
  ]);
  const actionsInLabel = filterByCategory(actionItems, category);
  const uncertainCount = actionsInLabel.filter((item) =>
    isUncertainClassification(item.confidence),
  ).length;
  const tabActions =
    uncertainOnly && actionStatus
      ? actionItems.filter((item) => isUncertainClassification(item.confidence))
      : actionItems;
  const visibleItems = filterByCategory(tabActions, category);
  const visibleSummary = filterByCategory(summaryThreads, category);
  const visibleIgnored = filterByCategory(ignoredThreads, category);
  const labelSource: Array<ActionListItem | RecentThreadRow> = actionStatus
    ? tabActions
    : tab === "summary"
      ? summaryThreads
      : ignoredThreads;
  const labelOptions = categoryFilterCounts(labelSource, category);
  const categoryLabel = category ? CATEGORY_LABELS[category] : null;
  const categoryHrefFor = (item: ActionListItem | RecentThreadRow) =>
    mailViewPath({
      tab,
      category: normalizeCategory(item.category),
      uncertain: uncertainOnly,
    });
  const staleWaitingCount =
    tab === "waiting" ? visibleItems.filter((item) => isStaleWaiting(item.updatedAt)).length : 0;
  const needsGmailRecovery = shouldShowGmailRecoveryCard(gmailStatus);
  const emptyAction = needsGmailRecovery ? (
    <a href="/api/gmail/connect?returnTo=/mail" className={buttonVariants({ size: "sm" })}>
      {gmailRecoveryActionLabel(gmailStatus)}
    </a>
  ) : (
    <Link href="/scan" className={buttonVariants({ size: "sm" })}>
      Scan now
    </Link>
  );

  return (
    <AppChrome user={user} current="mail">
      <PageHeader title="Mail" description={tabDescription(tab)} />
      <nav aria-label="Mail views" className="flex items-stretch gap-3 overflow-x-auto pb-1">
        {MAIL_SECTION_GROUPS.map((group, index) => (
          <div key={group.label} className="flex min-w-0 items-stretch gap-3">
            {index > 0 ? <div className="bg-border w-px shrink-0" aria-hidden /> : null}
            <div className="flex gap-2">
              {group.items.map((item) => {
                const meta = MAIL_TABS.find((entry) => entry.id === item.id);
                const active = tab === item.id;
                return (
                  <Link
                    key={item.id}
                    href={mailViewPath({ tab: item.id, category, uncertain: uncertainOnly })}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "focus-visible:ring-ring flex min-w-36 flex-col rounded-xl border px-3 py-2.5 transition-colors focus-visible:ring-3 focus-visible:outline-none",
                      active
                        ? "border-primary bg-primary/10 text-foreground"
                        : "border-border bg-card text-muted-foreground hover:text-foreground",
                    )}
                  >
                    <span className="flex items-center justify-between gap-3">
                      <span className={cn("text-sm", active && "font-medium")}>{meta?.label}</span>
                      <span className="text-foreground text-sm font-semibold tabular-nums">
                        {sectionCount(item.id, figures)}
                      </span>
                    </span>
                    <span className="mt-1 text-xs">{item.hint}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>
      {queryError ? (
        <EmptyState
          variant="error"
          title={`Could not load ${tab === "open" ? "actions" : tab === "waiting" ? "pending tasks" : tab === "summary" ? "summary threads" : tab === "ignored" ? "ignored mail" : "tasks"}`}
          description="We had trouble reaching the database. Reload to try again. Your mailbox data is safe."
          action={
            <Link
              href={mailViewPath({ tab, category, uncertain: uncertainOnly })}
              className={buttonVariants({ size: "sm", variant: "outline" })}
            >
              Reload view
            </Link>
          }
        />
      ) : (
        <>
          <MailCategoryFilters
            tab={tab}
            options={labelOptions}
            active={category}
            total={labelSource.length}
            uncertain={uncertainOnly}
          />
          {categoryLabel ? (
            <p className="text-muted-foreground text-sm">
              Showing {categoryLabel} in this tab.{" "}
              <Link
                href={mailViewPath({ tab, uncertain: uncertainOnly })}
                className="text-primary font-medium hover:underline"
              >
                Show all labels
              </Link>
            </p>
          ) : null}
          {actionStatus && (uncertainCount > 0 || uncertainOnly) ? (
            <p className="text-muted-foreground text-sm">
              {uncertainOnly ? (
                <>
                  Showing {visibleItems.length} uncertain{" "}
                  {visibleItems.length === 1 ? "classification" : "classifications"}.{" "}
                  <Link
                    href={mailViewPath({ tab, category })}
                    className="text-primary font-medium hover:underline"
                  >
                    Show all
                  </Link>
                </>
              ) : (
                <>
                  {uncertainCount} classification{uncertainCount === 1 ? " is" : "s are"} uncertain.{" "}
                  <Link
                    href={mailViewPath({ tab, category, uncertain: true })}
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
              {staleWaitingCount} pending item{staleWaitingCount === 1 ? " has" : "s have"} been
              quiet for a week or more.
            </p>
          ) : null}
          {tab === "summary" ? (
            <InboxSummary
              threads={visibleSummary}
              storageKey={`mail-summary${category ? `-${category}` : ""}`}
              emptyTitle={categoryLabel ? `No ${categoryLabel} mail in this view.` : empty.title}
              emptyDescription={
                categoryLabel
                  ? `Nothing in For You is labeled ${categoryLabel}.`
                  : empty.description
              }
              emptyAction={emptyAction}
              categoryHrefFor={categoryHrefFor}
            />
          ) : null}
          {tab === "ignored" ? (
            <InboxSummary
              threads={visibleIgnored}
              storageKey={`mail-ignored${category ? `-${category}` : ""}`}
              emptyTitle={categoryLabel ? `No ${categoryLabel} mail in this view.` : empty.title}
              emptyDescription={
                categoryLabel
                  ? `Nothing in Ignored is labeled ${categoryLabel}.`
                  : empty.description
              }
              emptyAction={emptyAction}
              categoryHrefFor={categoryHrefFor}
            />
          ) : null}
          {actionStatus ? (
            <GroupedActionList
              items={visibleItems}
              storageKey={`mail-${tab}${category ? `-${category}` : ""}${uncertainOnly ? "-uncertain" : ""}`}
              emptyTitle={
                categoryLabel
                  ? `No ${categoryLabel} mail in this view.`
                  : uncertainOnly
                    ? "No uncertain classifications in this view."
                    : empty.title
              }
              emptyDescription={
                categoryLabel
                  ? `Nothing in this tab is labeled ${categoryLabel}.`
                  : uncertainOnly
                    ? "Threads the classifier is unsure about would appear here so you can double-check them."
                    : empty.description
              }
              emptyAction={emptyAction}
              categoryHrefFor={categoryHrefFor}
            />
          ) : null}
        </>
      )}
    </AppChrome>
  );
}
