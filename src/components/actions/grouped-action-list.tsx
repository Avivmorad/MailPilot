import type { ReactNode } from "react";

import { ActionItemCard } from "@/components/actions/action-item-card";
import { EmptyState } from "@/components/layout/empty-state";
import { CollapsibleTopicGroups } from "@/components/layout/collapsible-topic-groups";
import type { ActionListItem } from "@/lib/actions/queries";
import { groupByTopic } from "@/lib/actions/topics";

export function GroupedActionList({
  items,
  storageKey = "open-tasks",
  emptyTitle = "No open tasks",
  emptyDescription = "When a thread still needs a real next step, it will show up here — grouped by topic.",
  emptyAction,
}: {
  items: ActionListItem[];
  storageKey?: string;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyAction?: ReactNode;
}) {
  if (items.length === 0) {
    return <EmptyState title={emptyTitle} description={emptyDescription} action={emptyAction} />;
  }
  const groups = groupByTopic(items);
  return (
    <CollapsibleTopicGroups
      storageKey={storageKey}
      groups={groups.map((group) => ({
        topic: group.topic,
        count: group.items.length,
        body: (
          <div className="space-y-3">
            {group.items.map((item) => (
              <ActionItemCard key={item.id} item={item} />
            ))}
          </div>
        ),
      }))}
    />
  );
}
