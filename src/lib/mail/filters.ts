import { CATEGORY_VALUES, isCategory, type Category } from "@/lib/ai/categories";
import { confidenceBand } from "@/lib/ai/post-process";
import { groupByTopic, topicForItem, type TopicableItem } from "@/lib/actions/topics";
import { STALE_WAITING_MS } from "@/lib/dashboard/changes";

export function isUncertainClassification(confidence: number | null | undefined): boolean {
  if (confidence == null || !Number.isFinite(confidence)) {
    return false;
  }
  return confidenceBand(confidence) !== "normal";
}

export function parseUncertainFilter(value: string | string[] | undefined): boolean {
  const raw = Array.isArray(value) ? value[0] : value;
  return raw === "1" || raw === "true";
}

/** Category label from `?category=`, matching the Mail topic groups. */
export function parseCategoryFilter(value: string | string[] | undefined): Category | null {
  const raw = Array.isArray(value) ? value[0] : value;
  if (!raw) {
    return null;
  }
  const key = raw.trim().toLowerCase();
  return isCategory(key) ? key : null;
}

export function filterByCategory<T extends TopicableItem>(
  items: T[],
  category: Category | null,
): T[] {
  if (!category) {
    return items;
  }
  return items.filter((item) => topicForItem(item) === category);
}

export function categoryFilterCounts(
  items: TopicableItem[],
  active: Category | null,
): Array<{ category: Category; count: number }> {
  const counts = new Map(groupByTopic(items).map((group) => [group.topic, group.items.length]));
  if (active && !counts.has(active)) {
    counts.set(active, 0);
  }
  return CATEGORY_VALUES.filter((category) => counts.has(category)).map((category) => ({
    category,
    count: counts.get(category) ?? 0,
  }));
}

export function isStaleWaiting(
  updatedAt: string | null | undefined,
  now: Date = new Date(),
): boolean {
  if (!updatedAt) {
    return false;
  }
  const updated = Date.parse(updatedAt);
  return Number.isFinite(updated) && updated < now.getTime() - STALE_WAITING_MS;
}
