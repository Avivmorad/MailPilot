"use client";

import { ChevronDown } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";

import {
  collapsedStorageKey,
  parseCollapsedIds,
  serializeCollapsedIds,
  toggleCollapsedId,
} from "@/lib/ui/collapsed-state";
import { cn } from "@/lib/utils";

const SECTION_ID = "self";

export function CollapsibleBlock({
  storageKey,
  title,
  description,
  action,
  children,
}: {
  storageKey: string;
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  const [collapsed, setCollapsed] = useState<string[]>([]);
  const [ready, setReady] = useState(false);
  const open = !collapsed.includes(SECTION_ID);

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

  return (
    <section className="space-y-3">
      <div className="flex items-start justify-between gap-4">
        <button
          type="button"
          aria-expanded={open}
          className="hover:bg-muted/50 -ms-2 min-w-0 flex-1 rounded-lg px-2 py-1 text-start transition-colors"
          onClick={() => setCollapsed(toggleCollapsedId(collapsed, SECTION_ID, open))}
        >
          <span className="flex items-center gap-2">
            <ChevronDown
              className={cn(
                "text-muted-foreground size-4 shrink-0 transition-transform duration-200",
                open ? "rotate-0" : "-rotate-90",
              )}
              aria-hidden
            />
            <span className="text-foreground text-lg font-bold tracking-tight">{title}</span>
            <span className="text-muted-foreground text-xs font-normal">{open ? "Hide" : "Show"}</span>
          </span>
          {description ? <p className="text-muted-foreground mt-0.5 ps-6 text-sm">{description}</p> : null}
        </button>
        {action}
      </div>
      <div
        className={cn(
          "grid transition-[grid-template-rows] duration-200 ease-out",
          open ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
        )}
      >
        <div className="overflow-hidden">
          <div aria-hidden={!open} inert={!open ? true : undefined}>
            {children}
          </div>
        </div>
      </div>
    </section>
  );
}
