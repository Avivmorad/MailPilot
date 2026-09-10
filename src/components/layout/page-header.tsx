import type { ReactNode } from "react";

export function PageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="max-w-2xl">
        <h1 className="text-foreground text-2xl font-bold tracking-tight text-balance sm:text-3xl">{title}</h1>
        {description ? (
          <p className="text-muted-foreground mt-1.5 text-sm leading-relaxed text-pretty sm:text-base">
            {description}
          </p>
        ) : null}
      </div>
      {action}
    </div>
  );
}
