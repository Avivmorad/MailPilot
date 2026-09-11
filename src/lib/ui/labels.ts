import { CATEGORY_LABELS } from "@/lib/ai/categories";

const LABEL_OVERRIDES: Record<string, string> = {
  ...CATEGORY_LABELS,
  action_required: "Needs action",
  informational: "FYI",
  follow_up: "Follow up",
  inbound: "Received",
  outbound: "Sent by you",
  self: "Sent by you",
  unknown: "Unknown",
  running: "In progress",
  success: "Finished",
  partial: "Finished with errors",
  failed: "Failed",
  initial: "Initial scan",
  manual: "Manual scan",
  scheduled: "Scheduled scan",
  recovery: "Recovery scan",
  open: "Open",
  waiting: "Waiting",
  completed: "Done",
  snoozed: "Snoozed",
  urgent: "Urgent",
  soon: "Soon",
  later: "Later",
  expired: "Expired",
  normal: "Normal",
  none: "None",
  high: "High",
  medium: "Medium",
  low: "Low",
  ignore: "Ignore",
  resolved: "Resolved",
};

export function humanizeToken(value: string | null | undefined): string {
  if (!value) {
    return "";
  }
  const key = value.trim().toLowerCase().replace(/[_-]+/g, "_");
  const override = LABEL_OVERRIDES[key];
  if (override) {
    return override;
  }
  const words = key.replace(/_/g, " ").split(/\s+/).filter(Boolean);
  if (words.length === 0) {
    return value;
  }
  return words
    .map((word, index) =>
      index === 0 ? word.charAt(0).toUpperCase() + word.slice(1) : word,
    )
    .join(" ");
}

export function labelForUrgency(value: string | null | undefined): string {
  return humanizeToken(value);
}

export function labelForImportance(value: string | null | undefined): string {
  return humanizeToken(value);
}

export function labelForThreadStatus(value: string | null | undefined): string {
  return humanizeToken(value);
}

export function labelForActionType(value: string | null | undefined): string {
  return humanizeToken(value);
}

export function labelForScanStatus(value: string | null | undefined): string {
  return humanizeToken(value);
}

export function labelForDirection(value: string | null | undefined): string {
  return humanizeToken(value);
}

export function accentForUrgency(value: string | null | undefined): string {
  switch (value?.toLowerCase()) {
    case "urgent":
    case "expired":
      return "border-l-destructive";
    case "soon":
      return "border-l-orange-500";
    case "later":
      return "border-l-sky-400";
    default:
      return "border-l-transparent";
  }
}
