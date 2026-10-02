import { CATEGORY_LABELS, type Category } from "@/lib/ai/categories";
import { mailViewPath, type MailTab } from "@/lib/mail/tabs";
import { interactiveChipClass } from "@/lib/ui/interactive";
import { cn } from "@/lib/utils";

export function MailCategoryFilters({
  tab,
  options,
  active,
  total,
  uncertain = false,
  onSelect,
}: {
  tab: MailTab;
  options: Array<{ category: Category; count: number }>;
  active: Category | null;
  total: number;
  uncertain?: boolean;
  /** Client tab switch. Same hrefs; skips a server navigation. */
  onSelect?: (href: string) => void;
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
        onSelect={onSelect}
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
          onSelect={onSelect}
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
  onSelect,
}: {
  href: string;
  label: string;
  count: number;
  active: boolean;
  onSelect?: (href: string) => void;
}) {
  return (
    <a
      href={href}
      aria-current={active ? "page" : undefined}
      onClick={(event) => {
        if (!onSelect || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
          return;
        }
        event.preventDefault();
        onSelect(href);
      }}
      className={cn(
        interactiveChipClass,
        "inline-flex w-max max-w-full shrink-0 items-center gap-2 rounded-xl border px-3 py-2.5",
        active
          ? "border-primary bg-primary/10 text-foreground"
          : "border-border bg-card text-muted-foreground hover:bg-muted/40 hover:text-foreground",
      )}
    >
      <span className={cn("text-sm", active && "font-medium")}>{label}</span>
      <span className="text-foreground shrink-0 text-sm font-semibold tabular-nums">{count}</span>
    </a>
  );
}
