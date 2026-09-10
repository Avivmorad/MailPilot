export function EmptyState({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  return (
    <div className="border-border/80 bg-card rounded-xl border border-dashed px-5 py-8 text-center">
      <p className="text-foreground font-semibold tracking-tight">{title}</p>
      {description ? <p className="text-muted-foreground mt-1 text-sm leading-relaxed">{description}</p> : null}
    </div>
  );
}
