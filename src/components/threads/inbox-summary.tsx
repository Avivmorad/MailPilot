import type { ReactNode } from "react";
import Link from "next/link";

import { EmptyState } from "@/components/layout/empty-state";
import { CollapsibleTopicGroups } from "@/components/layout/collapsible-topic-groups";
import { ThreadTags } from "@/components/ui/thread-tags";
import { groupByTopic } from "@/lib/actions/topics";
import type { RecentThreadRow } from "@/lib/threads/queries";
import { formatRelativeTime } from "@/lib/ui/format";

export function InboxSummary({
  threads,
  storageKey = "inbox-summary",
  emptyTitle = "No classified mail yet",
  emptyDescription = "Run a scan to see leftover FYI. Receipts, OTPs, and marketing are in Ignored.",
  emptyAction,
}: {
  threads: RecentThreadRow[];
  storageKey?: string;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyAction?: ReactNode;
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
            {group.items.map((thread) => (
              <li key={thread.id}>
                <Link
                  href={`/thread/${thread.id}`}
                  className="hover:bg-muted/50 block px-4 py-3 transition-colors"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <p
                      className="text-foreground min-w-0 flex-1 font-semibold leading-snug tracking-tight break-words"
                      dir="auto"
                      title={thread.shortDisplayTitle ?? thread.summary ?? "Thread"}
                    >
                      {thread.shortDisplayTitle ?? thread.summary ?? "Thread"}
                    </p>
                    <div className="flex min-w-0 flex-wrap items-center justify-end gap-2">
                      <ThreadTags
                        category={thread.category}
                        status={thread.status}
                        importance={thread.importance}
                      />
                      <span className="text-muted-foreground text-xs">
                        {formatRelativeTime(thread.latestMessageAt)}
                      </span>
                    </div>
                  </div>
                  {thread.summary && thread.shortDisplayTitle ? (
                    <p className="text-muted-foreground mt-1 line-clamp-2 text-sm leading-relaxed" dir="auto">
                      {thread.summary}
                    </p>
                  ) : null}
                </Link>
              </li>
            ))}
          </ul>
        ),
      }))}
    />
  );
}
