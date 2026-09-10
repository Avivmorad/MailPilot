import Link from "next/link";

import { EmptyState } from "@/components/layout/empty-state";
import { CollapsibleTopicGroups } from "@/components/layout/collapsible-topic-groups";
import { MetaBadge } from "@/components/ui/meta-badge";
import { groupByTopic } from "@/lib/actions/topics";
import type { RecentThreadRow } from "@/lib/threads/queries";
import { formatRelativeTime } from "@/lib/ui/format";

export function InboxSummary({
  threads,
  storageKey = "inbox-summary",
  emptyTitle = "No classified mail yet",
  emptyDescription = "Run a scan to see quick FYI updates. Ignored mail is in the Ignored tab, not here.",
}: {
  threads: RecentThreadRow[];
  storageKey?: string;
  emptyTitle?: string;
  emptyDescription?: string;
}) {
  if (threads.length === 0) {
    return <EmptyState title={emptyTitle} description={emptyDescription} />;
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
                    <p className="text-foreground min-w-0 w-full text-center font-semibold leading-snug tracking-tight" dir="auto">
                      {thread.shortDisplayTitle ?? thread.summary ?? "Thread"}
                    </p>
                    <div className="flex shrink-0 items-center gap-2">
                      {thread.status ? <MetaBadge kind="status" value={thread.status} /> : null}
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
