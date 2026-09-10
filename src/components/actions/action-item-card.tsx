import Link from "next/link";

import { ActionControls } from "@/components/actions/action-controls";
import { MetaBadge } from "@/components/ui/meta-badge";
import type { ActionListItem } from "@/lib/actions/queries";
import { formatDate, formatRelativeTime } from "@/lib/ui/format";
import { accentForUrgency } from "@/lib/ui/labels";
import { cn } from "@/lib/utils";

export function ActionItemCard({ item }: { item: ActionListItem }) {
  return (
    <article
      className={cn(
        "bg-card ring-foreground/10 rounded-xl border-l-4 p-4 shadow-xs ring-1 sm:p-5",
        accentForUrgency(item.urgency),
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <h3 className="text-foreground text-base leading-snug font-semibold tracking-tight" dir="auto">
            <Link href={`/thread/${item.threadId}`} className="hover:underline">
              {item.title}
            </Link>
          </h3>
          {item.sender ? <p className="text-muted-foreground mt-1 text-sm">{item.sender}</p> : null}
        </div>
        <div className="flex flex-wrap gap-1">
          {item.urgency && item.urgency !== "none" && item.urgency !== "normal" ? (
            <MetaBadge kind="urgency" value={item.urgency} />
          ) : null}
          {item.importance && item.importance !== "low" ? (
            <MetaBadge kind="importance" value={item.importance} />
          ) : null}
          {item.actionType ? <MetaBadge value={item.actionType} /> : null}
        </div>
      </div>

      {item.description ? (
        <p className="bg-muted/60 mt-3 rounded-lg px-3 py-2 text-sm leading-relaxed" dir="auto">
          <span className="text-muted-foreground">Do: </span>
          {item.description}
        </p>
      ) : item.summary ? (
        <p className="text-muted-foreground mt-3 text-sm leading-relaxed" dir="auto">
          {item.summary}
        </p>
      ) : null}

      {item.waitingFor ? (
        <p className="mt-2 text-sm">
          <span className="text-muted-foreground">Waiting on: </span>
          {item.waitingFor}
        </p>
      ) : null}

      <p className="text-muted-foreground mt-3 text-xs">
        Deadline {formatDate(item.deadline)} · {formatRelativeTime(item.latestMessageAt)}
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-3 border-t pt-3">
        <ActionControls actionId={item.id} status={item.status} />
        <a
          href={item.gmailUrl}
          target="_blank"
          rel="noreferrer"
          className="text-muted-foreground hover:text-foreground text-sm underline-offset-4 hover:underline"
        >
          Open in Gmail
        </a>
      </div>
    </article>
  );
}
