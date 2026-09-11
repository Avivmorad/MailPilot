import type { ReactNode } from "react";

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="border-border/80 bg-card rounded-xl border border-dashed px-5 py-10 text-center">
      <p className="text-foreground font-semibold tracking-tight">{title}</p>
      {description ? (
        <p className="text-muted-foreground mx-auto mt-1.5 max-w-md text-sm leading-relaxed">
          {description}
        </p>
      ) : null}
      {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
    </div>
  );
}
