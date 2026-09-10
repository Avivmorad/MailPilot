import { ActionItemCard } from "@/components/actions/action-item-card";
import type { ActionListItem } from "@/lib/actions/queries";
import { ACTION_TOPIC_LABELS, groupByTopic } from "@/lib/actions/topics";

export function GroupedActionList({ items }: { items: ActionListItem[] }) {
  if (items.length === 0) {
    return <p className="text-muted-foreground text-sm">No open tasks.</p>;
  }
  const groups = groupByTopic(items);
  return (
    <div className="space-y-6">
      {groups.map((group) => (
        <section key={group.topic} className="space-y-3">
          <h3 className="text-muted-foreground text-sm font-medium tracking-wide">
            {ACTION_TOPIC_LABELS[group.topic]}
          </h3>
          {group.items.map((item) => (
            <ActionItemCard key={item.id} item={item} />
          ))}
        </section>
      ))}
    </div>
  );
}
