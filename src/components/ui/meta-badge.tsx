import { Badge } from "@/components/ui/badge";
import {
  humanizeToken,
  toneForImportance,
  toneForThreadStatus,
  toneForUrgency,
  type BadgeTone,
} from "@/lib/ui/labels";
import { cn } from "@/lib/utils";

const TONE_CLASS: Record<BadgeTone, string> = {
  danger: "border-transparent bg-destructive/15 text-destructive dark:bg-destructive/25",
  warning:
    "border-transparent bg-orange-500/20 text-orange-900 dark:bg-orange-400/20 dark:text-orange-100",
  success:
    "border-transparent bg-green-500/20 text-green-900 dark:bg-green-400/20 dark:text-green-100",
  info: "border-transparent bg-sky-500/20 text-sky-800 dark:bg-sky-400/20 dark:text-sky-100",
  accent: "border-transparent bg-primary/15 text-primary dark:bg-primary/25",
  neutral: "",
  muted: "border-transparent bg-muted text-muted-foreground",
};

export function MetaBadge({
  value,
  kind = "generic",
}: {
  value: string;
  kind?: "urgency" | "importance" | "status" | "generic";
}) {
  const tone =
    kind === "urgency"
      ? toneForUrgency(value)
      : kind === "importance"
        ? toneForImportance(value)
        : kind === "status"
          ? toneForThreadStatus(value)
          : "neutral";

  return (
    <Badge variant={tone === "neutral" ? "outline" : "secondary"} className={cn(TONE_CLASS[tone])}>
      {humanizeToken(value)}
    </Badge>
  );
}
