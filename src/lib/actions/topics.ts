import { isEphemeralAuthNotice, isLoginFyiNotice } from "@/lib/ai/notices";

export const ACTION_TOPICS = ["security", "payments", "general"] as const;
export type ActionTopic = (typeof ACTION_TOPICS)[number];

export const ACTION_TOPIC_LABELS: Record<ActionTopic, string> = {
  security: "אבטחה",
  payments: "תשלומים",
  general: "כללי",
};

export interface TopicableItem {
  category?: string | null;
  actionType?: string | null;
  title?: string | null;
  summary?: string | null;
  shortDisplayTitle?: string | null;
  description?: string | null;
}

export function topicForItem(item: TopicableItem): ActionTopic {
  const noticeParts = [item.title, item.shortDisplayTitle, item.summary, item.description];
  if (isLoginFyiNotice(noticeParts) || isEphemeralAuthNotice(noticeParts) || item.category === "account") {
    return "security";
  }
  if (item.actionType === "pay" || item.category === "finance" || item.category === "shopping") {
    return "payments";
  }
  return "general";
}

export function groupByTopic<T extends TopicableItem>(items: T[]): Array<{ topic: ActionTopic; items: T[] }> {
  const buckets: Record<ActionTopic, T[]> = {
    security: [],
    payments: [],
    general: [],
  };
  for (const item of items) {
    buckets[topicForItem(item)].push(item);
  }
  return ACTION_TOPICS.filter((topic) => buckets[topic].length > 0).map((topic) => ({
    topic,
    items: buckets[topic],
  }));
}
