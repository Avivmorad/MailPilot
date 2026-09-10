"use client";

import { ChevronDown } from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";

import { ACTION_TOPIC_LABELS, type ActionTopic } from "@/lib/actions/topics";
import {
  collapsedStorageKey,
  parseCollapsedIds,
  serializeCollapsedIds,
  toggleCollapsedId,
} from "@/lib/ui/collapsed-state";
import { cn } from "@/lib/utils";

export interface CollapsibleTopicGroup {
  topic: ActionTopic;
  count: number;
  body: ReactNode;
}

export function CollapsibleTopicGroups({
  storageKey,
  groups,
  variant = "plain",
}: {
  storageKey: string;
  groups: CollapsibleTopicGroup[];
  variant?: "plain" | "panel";
}) {
  const topicIds = useMemo(() => groups.map((group) => group.topic), [groups]);
  const [collapsed, setCollapsed] = useState<string[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setCollapsed(parseCollapsedIds(window.localStorage.getItem(collapsedStorageKey(storageKey))));
    setReady(true);
  }, [storageKey]);

  useEffect(() => {
    if (!ready) {
      return;
    }
    window.localStorage.setItem(collapsedStorageKey(storageKey), serializeCollapsedIds(collapsed));
  }, [collapsed, ready, storageKey]);

  const allCollapsed = topicIds.length > 0 && topicIds.every((id) => collapsed.includes(id));

  function setAll(nextCollapsed: boolean) {
    setCollapsed(nextCollapsed ? topicIds : []);
  }

  return (
    <div className="space-y-3">
      {groups.length > 1 ? (
        <div className="flex justify-end">
          <button
            type="button"
            className="text-muted-foreground hover:text-foreground text-sm font-medium hover:underline"
            onClick={() => setAll(!allCollapsed)}
          >
            {allCollapsed ? "Expand all" : "Collapse all"}
          </button>
        </div>
      ) : null}
      <div className="space-y-4">
        {groups.map((group) => {
          const open = !collapsed.includes(group.topic);
          return (
            <section
              key={group.topic}
              className={cn(
                variant === "panel" && "bg-card ring-foreground/10 overflow-hidden rounded-xl ring-1",
              )}
            >
              <button
                type="button"
                aria-expanded={open}
                className={cn(
                  "text-foreground hover:bg-muted/60 flex w-full items-center gap-2 px-1 py-2 text-start text-sm font-semibold tracking-tight transition-colors",
                  variant === "panel" && "px-4 py-2.5",
                  variant === "panel" && open && "border-b",
                )}
                onClick={() => setCollapsed(toggleCollapsedId(collapsed, group.topic, open))}
              >
                <ChevronDown
                  className={cn(
                    "text-muted-foreground size-4 shrink-0 transition-transform duration-200",
                    open ? "rotate-0" : "-rotate-90",
                  )}
                  aria-hidden
                />
                <span className="min-w-0 truncate font-bold" dir="auto">
                  {ACTION_TOPIC_LABELS[group.topic]}
                </span>
                <span className="text-muted-foreground tabular-nums">{group.count}</span>
                <span className="text-muted-foreground ms-auto text-xs font-normal">
                  {open ? "Hide" : "Show"}
                </span>
              </button>
              <div
                className={cn(
                  "grid transition-[grid-template-rows] duration-200 ease-out",
                  open ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
                )}
              >
                <div className="overflow-hidden">
                  <div
                    className={cn(variant === "panel" ? "" : "space-y-3 pt-1")}
                    aria-hidden={!open}
                    inert={!open ? true : undefined}
                  >
                    {group.body}
                  </div>
                </div>
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
