"use client";

import Link from "next/link";
import { useEffect, useState, type MouseEvent, type ReactNode } from "react";

import { GroupedActionList } from "@/components/actions/grouped-action-list";
import { EmptyState } from "@/components/layout/empty-state";
import { PageHeader } from "@/components/layout/page-header";
import { MailCategoryFilters } from "@/components/mail/category-filters";
import { InboxSummary } from "@/components/threads/inbox-summary";
import { buttonVariants } from "@/components/ui/button";
import type { ActionListItem } from "@/lib/actions/action-list-item";
import { CATEGORY_LABELS, normalizeCategory } from "@/lib/ai/categories";
import {
  categoryFilterCounts,
  filterByCategory,
  isStaleWaiting,
  isUncertainClassification,
  parseCategoryFilter,
  parseUncertainFilter,
} from "@/lib/mail/filters";
import type { MailFigures } from "@/lib/mail/mail-figures";
import {
  actionStatusForMailTab,
  MAIL_TABS,
  mailTabEmptyCopy,
  mailViewPath,
  parseMailTab,
  type MailTab,
} from "@/lib/mail/tabs";
import type { RecentThreadRow } from "@/lib/threads/recent-thread";
import { interactiveChipClass } from "@/lib/ui/interactive";
import { cn } from "@/lib/utils";

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

export interface MailWorkspaceData {
  open: ActionListItem[];
  waiting: ActionListItem[];
  completed: ActionListItem[];
  snoozed: ActionListItem[];
  summary: RecentThreadRow[];
  ignored: RecentThreadRow[];
  failed: Partial<Record<MailTab, boolean>>;
  figures: MailFigures | null;
  needsGmailRecovery: boolean;
  recoveryLabel: string;
}

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

function tabDescription(tab: MailTab): string {
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

function actionsForTab(tab: MailTab, data: MailWorkspaceData): ActionListItem[] {
  switch (tab) {
    case "open":
      return data.open;
    case "waiting":
      return data.waiting;
    case "completed":
      return data.completed;
    case "snoozed":
      return data.snoozed;
    default:
      return [];
  }
}

function readView(search: string): {
  tab: MailTab;
  category: ReturnType<typeof parseCategoryFilter>;
  uncertain: boolean;
} {
  const params = new URLSearchParams(search);
  return {
    tab: parseMailTab(params.get("tab")),
    category: parseCategoryFilter(params.get("category") ?? undefined),
    uncertain: parseUncertainFilter(params.get("uncertain") ?? undefined),
  };
}

export function MailWorkspace({
  data,
  initialTab,
  initialCategory,
  initialUncertain,
}: {
  data: MailWorkspaceData;
  initialTab: MailTab;
  initialCategory: ReturnType<typeof parseCategoryFilter>;
  initialUncertain: boolean;
}) {
  const [view, setView] = useState({
    tab: initialTab,
    category: initialCategory,
    uncertain: initialUncertain,
  });

  useEffect(() => {
    function onPopState() {
      setView(readView(window.location.search));
    }
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  function showHref(href: string, history: "push" | "replace" = "push") {
    const next = readView(href.includes("?") ? href.slice(href.indexOf("?")) : "");
    setView(next);
    const url = href.startsWith("/mail") ? href : `/mail${href}`;
    if (history === "replace") {
      window.history.replaceState(null, "", url);
    } else {
      window.history.pushState(null, "", url);
    }
  }

  function onViewClick(event: MouseEvent<HTMLAnchorElement>, href: string) {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) {
      return;
    }
    event.preventDefault();
    showHref(href);
  }

  const { tab, category, uncertain: uncertainOnly } = view;
  const actionStatus = actionStatusForMailTab(tab);
  const empty = mailTabEmptyCopy(tab);
  const queryError = Boolean(data.failed[tab]);
  const actionItems = actionsForTab(tab, data);
  const summaryThreads = tab === "summary" ? data.summary : [];
  const ignoredThreads = tab === "ignored" ? data.ignored : [];
  const actionsInLabel = filterByCategory(actionItems, category);
  const uncertainCount = actionsInLabel.filter((item) =>
    isUncertainClassification(item.confidence),
  ).length;
  const tabActions =
    uncertainOnly && actionStatus
      ? actionItems.filter((item) => isUncertainClassification(item.confidence))
      : actionItems;
  const visibleItems = filterByCategory(tabActions, category);
  const visibleSummary = filterByCategory(data.summary, category);
  const visibleIgnored = filterByCategory(data.ignored, category);
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
  const emptyAction: ReactNode = data.needsGmailRecovery ? (
    <a href="/api/gmail/connect?returnTo=/mail" className={buttonVariants({ size: "sm" })}>
      {data.recoveryLabel}
    </a>
  ) : (
    <Link href="/scan" className={buttonVariants({ size: "sm" })}>
      Scan now
    </Link>
  );

  return (
    <>
      <PageHeader title="Mail" description={tabDescription(tab)} />
      <nav
        aria-label="Mail views"
        className="flex min-w-0 items-stretch gap-2 overflow-x-auto pb-1 sm:gap-3"
      >
        {MAIL_SECTION_GROUPS.map((group, index) => (
          <div key={group.label} className="flex shrink-0 items-stretch gap-2 sm:gap-3">
            {index > 0 ? <div className="bg-border w-px shrink-0" aria-hidden /> : null}
            <div className="flex gap-2">
              {group.items.map((item) => {
                const meta = MAIL_TABS.find((entry) => entry.id === item.id);
                const active = tab === item.id;
                const href = mailViewPath({ tab: item.id, category, uncertain: uncertainOnly });
                return (
                  <a
                    key={item.id}
                    href={href}
                    aria-current={active ? "page" : undefined}
                    onClick={(event) => onViewClick(event, href)}
                    className={cn(
                      interactiveChipClass,
                      "flex w-[7.25rem] shrink-0 flex-col rounded-xl border px-3 py-2.5 sm:w-36",
                      active
                        ? "border-primary bg-primary/10 text-foreground"
                        : "border-border bg-card text-muted-foreground hover:border-border hover:bg-muted/40 hover:text-foreground",
                    )}
                  >
                    <span className="flex min-w-0 items-center justify-between gap-2 sm:gap-3">
                      <span className={cn("min-w-0 truncate text-sm", active && "font-medium")}>
                        {meta?.label}
                      </span>
                      <span className="text-foreground shrink-0 text-sm font-semibold tabular-nums">
                        {sectionCount(item.id, data.figures)}
                      </span>
                    </span>
                    <span className="mt-1 line-clamp-2 text-xs leading-snug break-words">
                      {item.hint}
                    </span>
                  </a>
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
            onSelect={(href) => showHref(href)}
          />
          {categoryLabel ? (
            <p className="text-muted-foreground text-sm">
              Showing {categoryLabel} in this tab.{" "}
              <a
                href={mailViewPath({ tab, uncertain: uncertainOnly })}
                onClick={(event) =>
                  onViewClick(event, mailViewPath({ tab, uncertain: uncertainOnly }))
                }
                className="text-primary font-medium hover:underline"
              >
                Show all labels
              </a>
            </p>
          ) : null}
          {actionStatus && (uncertainCount > 0 || uncertainOnly) ? (
            <p className="text-muted-foreground text-sm">
              {uncertainOnly ? (
                <>
                  Showing {visibleItems.length} uncertain{" "}
                  {visibleItems.length === 1 ? "classification" : "classifications"}.{" "}
                  <a
                    href={mailViewPath({ tab, category })}
                    onClick={(event) => onViewClick(event, mailViewPath({ tab, category }))}
                    className="text-primary font-medium hover:underline"
                  >
                    Show all
                  </a>
                </>
              ) : (
                <>
                  {uncertainCount} classification{uncertainCount === 1 ? " is" : "s are"} uncertain.{" "}
                  <a
                    href={mailViewPath({ tab, category, uncertain: true })}
                    onClick={(event) =>
                      onViewClick(event, mailViewPath({ tab, category, uncertain: true }))
                    }
                    className="text-primary font-medium hover:underline"
                  >
                    Show uncertain only
                  </a>
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
              categoryHrefFor={(thread) => categoryHrefFor(thread)}
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
              categoryHrefFor={(thread) => categoryHrefFor(thread)}
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
              categoryHrefFor={(item) => categoryHrefFor(item)}
            />
          ) : null}
        </>
      )}
    </>
  );
}
