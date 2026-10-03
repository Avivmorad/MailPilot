import type { ReactNode } from "react";
import Link from "next/link";

import { EmptyState } from "@/components/layout/empty-state";
import { CollapsibleTopicGroups } from "@/components/layout/collapsible-topic-groups";
import { MailCardTitle, MailOpenLink } from "@/components/mail/mail-card-chrome";
import { ThreadPlacementCorrection } from "@/components/threads/thread-placement-correction";
import { ThreadTags } from "@/components/ui/thread-tags";
import { groupByTopic } from "@/lib/actions/topics";
import { threadPlacementReason } from "@/lib/mail/placement";
import { mailBucketForThread } from "@/lib/mail/buckets";
import type { RecentThreadRow } from "@/lib/threads/recent-thread";
import { displayThreadTitle, usableDisplayText } from "@/lib/ui/display-text";
import { formatRelativeTime } from "@/lib/ui/format";

export function InboxSummary({
  threads,
  storageKey = "inbox-summary",
  emptyTitle = "No classified mail yet",
  emptyDescription = "Run a scan to see useful updates. Receipts, OTPs, and marketing are in Ignored.",
  emptyAction,
  categoryHrefFor,
}: {
  threads: RecentThreadRow[];
  storageKey?: string;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyAction?: ReactNode;
  categoryHrefFor?: (thread: RecentThreadRow) => string;
}) {
  if (threads.length === 0) {
    return <EmptyState title={emptyTitle} description={emptyDescription} action={emptyAction} />;
  }
  const groups = groupByTopic(threads);
  return (
    <CollapsibleTopicGroups
      storageKey={storageKey}
      variant="panel"
      groups={groups.map((group) => ({
        topic: group.topic,
        count: group.items.length,
        body: (
          <ul className="divide-y">
            {group.items.map((thread) => {
              const tab = mailBucketForThread({ status: thread.status });
              const title = displayThreadTitle(
                thread.shortDisplayTitle,
                thread.summary,
                thread.subject,
              );
              const summary =
                usableDisplayText(thread.summary) && usableDisplayText(thread.shortDisplayTitle)
                  ? usableDisplayText(thread.summary)
                  : null;
              const href = `/thread/${thread.id}`;
              return (
                <li key={thread.id} className="min-w-0 overflow-hidden px-4 py-3">
                  <div className="flex min-w-0 items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <ThreadTags
                        category={thread.category}
                        status={thread.status}
                        importance={thread.importance}
                        categoryHref={categoryHrefFor?.(thread)}
                      />
                    </div>
                    <span className="text-muted-foreground shrink-0 pt-1 text-xs tabular-nums">
                      {formatRelativeTime(thread.latestMessageAt)}
                    </span>
                  </div>
                  <MailCardTitle title={title} className="mt-2">
                    <Link href={href} className="hover:underline">
                      {title}
                    </Link>
                  </MailCardTitle>
                  {summary ? (
                    <p
                      className="text-muted-foreground mt-1 line-clamp-2 text-start text-sm leading-relaxed [overflow-wrap:anywhere] break-words"
                      dir="auto"
                    >
                      {summary}
                    </p>
                  ) : null}
                  <p className="text-muted-foreground mt-1 text-start text-xs leading-relaxed break-words">
                    {threadPlacementReason({
                      tab,
                      importanceReason: thread.importanceReason,
                      summary: thread.summary,
                      title,
                      category: thread.category,
                      sender: thread.sender,
                    })}
                  </p>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <MailOpenLink href={href} />
                    <ThreadPlacementCorrection threadId={thread.id} tab={tab} />
                  </div>
                </li>
              );
            })}
          </ul>
        ),
      }))}
    />
  );
}
