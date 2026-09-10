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
  danger: "border-transparent bg-destructive/10 text-destructive",
  warning: "border-transparent bg-amber-500/12 text-amber-800 dark:text-amber-200",
  accent: "border-transparent bg-primary/10 text-primary",
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
