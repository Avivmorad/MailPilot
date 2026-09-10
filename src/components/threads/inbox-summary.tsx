import { ACTION_TOPIC_LABELS, groupByTopic } from "@/lib/actions/topics";
import type { RecentThreadRow } from "@/lib/threads/queries";
import { formatDateTime } from "@/lib/ui/format";

export function InboxSummary({ threads }: { threads: RecentThreadRow[] }) {
  if (threads.length === 0) {
    return <p className="text-muted-foreground text-sm">No classified mail yet.</p>;
  }
  const groups = groupByTopic(threads);
  return (
    <div className="space-y-5">
      {groups.map((group) => (
        <section key={group.topic}>
          <h3 className="text-muted-foreground mb-2 text-sm font-medium">
            {ACTION_TOPIC_LABELS[group.topic]}
          </h3>
          <ul className="space-y-2">
            {group.items.map((thread) => (
              <li key={thread.id}>
                <a href={`/thread/${thread.id}`} className="hover:underline" dir="auto">
                  {thread.shortDisplayTitle ?? thread.summary ?? "Thread"}
                </a>
                {thread.summary && thread.shortDisplayTitle ? (
                  <p className="text-muted-foreground text-sm" dir="auto">
                    {thread.summary}
                  </p>
                ) : null}
                <p className="text-muted-foreground text-xs">{formatDateTime(thread.latestMessageAt)}</p>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
