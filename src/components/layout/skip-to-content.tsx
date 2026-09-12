export function SkipToContent({ href = "#main-content" }: { href?: string }) {
  return (
    <a
      href={href}
      className="bg-primary text-primary-foreground focus-visible:ring-ring sr-only rounded-lg px-3 py-2 font-medium focus-visible:not-sr-only focus-visible:absolute focus-visible:top-3 focus-visible:left-3 focus-visible:z-50 focus-visible:ring-3"
    >
      Skip to content
    </a>
  );
}
