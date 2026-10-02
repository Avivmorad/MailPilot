import type { ReactNode } from "react";
import Link from "next/link";

import { EmptyState } from "@/components/layout/empty-state";
import { CollapsibleTopicGroups } from "@/components/layout/collapsible-topic-groups";
import { ThreadPlacementCorrection } from "@/components/threads/thread-placement-correction";
import { ThreadTags } from "@/components/ui/thread-tags";
import { groupByTopic } from "@/lib/actions/topics";
import { threadPlacementReason } from "@/lib/mail/placement";
import { mailBucketForThread } from "@/lib/mail/buckets";
import type { RecentThreadRow } from "@/lib/threads/queries";
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
              return (
                <li key={thread.id} className="px-4 py-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <Link
                      href={`/thread/${thread.id}`}
                      className="hover:bg-muted/50 -mx-1 min-w-0 flex-1 rounded-md px-1 transition-colors"
                    >
                      <p
                        className="text-foreground leading-snug font-semibold tracking-tight break-words"
                        dir="auto"
                        title={displayThreadTitle(
                          thread.shortDisplayTitle,
                          thread.summary,
                          thread.subject,
                        )}
                      >
                        {displayThreadTitle(
                          thread.shortDisplayTitle,
                          thread.summary,
                          thread.subject,
                        )}
                      </p>
                      {usableDisplayText(thread.summary) &&
                      usableDisplayText(thread.shortDisplayTitle) ? (
                        <p
                          className="text-muted-foreground mt-1 line-clamp-2 text-sm leading-relaxed"
                          dir="auto"
                        >
                          {usableDisplayText(thread.summary)}
                        </p>
                      ) : null}
                    </Link>
                    <div className="flex min-w-0 flex-wrap items-center justify-end gap-2">
                      <ThreadTags
                        category={thread.category}
                        status={thread.status}
                        importance={thread.importance}
                        categoryHref={categoryHrefFor?.(thread)}
                      />
                      <span className="text-muted-foreground text-xs">
                        {formatRelativeTime(thread.latestMessageAt)}
                      </span>
                    </div>
                  </div>
                  <p className="text-muted-foreground mt-1 text-xs leading-relaxed">
                    {threadPlacementReason({ tab })}
                  </p>
                  <ThreadPlacementCorrection threadId={thread.id} tab={tab} />
                </li>
              );
            })}
          </ul>
        ),
      }))}
    />
  );
}
