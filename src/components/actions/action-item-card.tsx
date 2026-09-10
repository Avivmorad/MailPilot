import { ActionControls } from "@/components/actions/action-controls";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ActionListItem } from "@/lib/actions/queries";
import { formatDate, formatDateTime } from "@/lib/ui/format";

export function ActionItemCard({ item }: { item: ActionListItem }) {
  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <CardTitle className="text-base" dir="auto">
            <a href={`/thread/${item.threadId}`} className="hover:underline">
              {item.title}
            </a>
          </CardTitle>
          <div className="flex flex-wrap gap-1">
            {item.urgency ? <Badge variant="secondary">{item.urgency}</Badge> : null}
            {item.importance ? <Badge variant="outline">{item.importance}</Badge> : null}
          </div>
        </div>
        {item.sender ? <p className="text-muted-foreground text-sm">{item.sender}</p> : null}
      </CardHeader>
      <CardContent className="space-y-3">
        {item.summary ? (
          <p className="text-sm" dir="auto">
            {item.summary}
          </p>
        ) : null}
        {item.description ? (
          <p className="text-sm">
            <span className="text-muted-foreground">What to do: </span>
            <span dir="auto">{item.description}</span>
          </p>
        ) : null}
        {item.waitingFor ? (
          <p className="text-sm">
            <span className="text-muted-foreground">Waiting on: </span>
            {item.waitingFor}
          </p>
        ) : null}
        <p className="text-muted-foreground text-xs">
          Deadline {formatDate(item.deadline)} · Last activity {formatDateTime(item.latestMessageAt)}
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <ActionControls actionId={item.id} status={item.status} />
          <a href={item.gmailUrl} target="_blank" rel="noreferrer" className="text-sm underline">
            Open in Gmail
          </a>
        </div>
      </CardContent>
    </Card>
  );
}
