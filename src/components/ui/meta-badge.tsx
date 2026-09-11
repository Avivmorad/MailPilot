"use client";

import { useId, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

import { Badge } from "@/components/ui/badge";
import { isVisibleTag, tagClassName, tagHint, tagLabel, type TagKind } from "@/lib/ui/tags";
import { cn } from "@/lib/utils";

function HoverHint({ hint, children }: { hint: string; children: ReactNode }) {
  const id = useId();
  const [rect, setRect] = useState<DOMRect | null>(null);

  function show(target: HTMLElement) {
    setRect(target.getBoundingClientRect());
  }

  return (
    <span
      className="inline-flex"
      onMouseEnter={(event) => show(event.currentTarget)}
      onMouseLeave={() => setRect(null)}
      onFocus={(event) => show(event.currentTarget)}
      onBlur={() => setRect(null)}
    >
      <span aria-describedby={rect ? id : undefined}>{children}</span>
      {rect
        ? createPortal(
            <span
              id={id}
              role="tooltip"
              className="bg-foreground text-background pointer-events-none fixed z-50 max-w-64 rounded-md px-2.5 py-1.5 text-xs leading-snug shadow-md"
              style={{
                left: Math.max(8, Math.min(rect.left, window.innerWidth - 272)),
                top: rect.bottom + 8 > window.innerHeight - 72 ? rect.top - 8 : rect.bottom + 8,
                transform: rect.bottom + 8 > window.innerHeight - 72 ? "translateY(-100%)" : undefined,
              }}
            >
              {hint}
            </span>,
            document.body,
          )
        : null}
    </span>
  );
}

export function MetaBadge({
  value,
  kind = "status",
}: {
  value: string;
  kind?: TagKind;
}) {
  if (!isVisibleTag(kind, value)) {
    return null;
  }

  const label = tagLabel(kind, value);
  const hint = tagHint(kind, value);
  const badge = (
    <Badge
      variant="secondary"
      tabIndex={hint ? 0 : undefined}
      aria-label={hint ? `${label}. ${hint}` : undefined}
      className={cn(tagClassName(kind, value), hint && "cursor-help")}
    >
      {label}
    </Badge>
  );

  if (!hint) {
    return badge;
  }

  return <HoverHint hint={hint}>{badge}</HoverHint>;
}
