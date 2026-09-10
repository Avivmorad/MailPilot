import { cn } from "@/lib/utils";

export interface LogoProps {
  className?: string;
  showWordmark?: boolean;
}

/**
 * Product logo: an inbox mark with a triage checkmark, plus the wordmark.
 */
export function Logo({ className, showWordmark = true }: LogoProps) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <svg
        viewBox="0 0 24 24"
        role="img"
        aria-label="MailPilot logo"
        className="text-primary size-6"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M4 13h4l2 3h4l2-3h4" />
        <path d="M5 13 7 5h10l2 8" />
        <path d="m9.5 8.5 1.5 1.5 3-3" />
      </svg>
      {showWordmark ? (
        <span className="text-foreground text-base font-bold tracking-tight">MailPilot</span>
      ) : null}
    </span>
  );
}
