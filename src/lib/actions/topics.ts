import {
  CATEGORY_LABELS,
  CATEGORY_VALUES,
  normalizeCategory,
  type Category,
} from "@/lib/ai/categories";
import { isEphemeralAuthNotice, isLoginFyiNotice, isSecurityEventNotice } from "@/lib/ai/notices";

export const ACTION_TOPICS = CATEGORY_VALUES;
export type ActionTopic = Category;

export const ACTION_TOPIC_LABELS = CATEGORY_LABELS;

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
  if (
    isLoginFyiNotice(noticeParts) ||
    isEphemeralAuthNotice(noticeParts) ||
    isSecurityEventNotice(noticeParts)
  ) {
    return "security";
  }
  const category = normalizeCategory(item.category);
  if (category === "other" && item.actionType === "pay") {
    return "finance";
  }
  return category;
}

export function groupByTopic<T extends TopicableItem>(items: T[]): Array<{ topic: ActionTopic; items: T[] }> {
  const buckets = {} as Record<ActionTopic, T[]>;
  for (const topic of ACTION_TOPICS) {
    buckets[topic] = [];
  }
  for (const item of items) {
    buckets[topicForItem(item)].push(item);
  }
  return ACTION_TOPICS.filter((topic) => buckets[topic].length > 0).map((topic) => ({
    topic,
    items: buckets[topic],
  }));
}
