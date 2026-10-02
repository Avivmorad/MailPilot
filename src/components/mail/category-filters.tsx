import Link from "next/link";

import { CATEGORY_LABELS, type Category } from "@/lib/ai/categories";
import { mailViewPath, type MailTab } from "@/lib/mail/tabs";
import { cn } from "@/lib/utils";

export function MailCategoryFilters({
  tab,
  options,
  active,
  total,
  uncertain = false,
}: {
  tab: MailTab;
  options: Array<{ category: Category; count: number }>;
  active: Category | null;
  total: number;
  uncertain?: boolean;
}) {
  if (options.length === 0) {
    return null;
  }

  return (
    <nav
      aria-label="Label filters"
      className="flex min-w-0 items-stretch gap-2 overflow-x-auto pb-1"
    >
      <LabelFilterLink
        href={mailViewPath({ tab, uncertain })}
        label="All labels"
        count={total}
        active={active === null}
      />
      {options.map((option) => (
        <LabelFilterLink
          key={option.category}
          href={
            active === option.category
              ? mailViewPath({ tab, uncertain })
              : mailViewPath({ tab, category: option.category, uncertain })
          }
          label={CATEGORY_LABELS[option.category]}
          count={option.count}
          active={active === option.category}
        />
      ))}
    </nav>
  );
}

function LabelFilterLink({
  href,
  label,
  count,
  active,
}: {
  href: string;
  label: string;
  count: number;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "focus-visible:ring-ring flex w-[7.25rem] shrink-0 flex-col rounded-xl border px-3 py-2.5 transition-[background-color,border-color,color,box-shadow] duration-150 focus-visible:ring-3 focus-visible:outline-none sm:w-36",
        active
          ? "border-primary bg-primary/10 text-foreground shadow-sm"
          : "border-border bg-card text-muted-foreground hover:bg-muted/40 hover:text-foreground",
      )}
    >
      <span className="flex min-w-0 items-center justify-between gap-3">
        <span className={cn("min-w-0 truncate text-sm", active && "font-medium")}>{label}</span>
        <span className="text-foreground shrink-0 text-sm font-semibold tabular-nums">{count}</span>
      </span>
    </Link>
  );
}
