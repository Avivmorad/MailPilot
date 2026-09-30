import type { ThreadAnalysis } from "@/lib/ai/schemas";
import type { MailPilotLogicalLabel } from "@/lib/gmail/constants";
import { MAILPILOT_LABELS } from "@/lib/gmail/constants";

export function logicalLabelsForAnalysis(analysis: ThreadAnalysis): MailPilotLogicalLabel[] {
  const labels = new Set<MailPilotLogicalLabel>(["processed"]);
  if (analysis.importance === "high") {
    labels.add("important");
  }
  if (analysis.requires_action || analysis.status === "action_required") {
    labels.add("action_required");
  }
  const openWorkflow = analysis.status === "action_required" || analysis.status === "waiting";
  if (
    analysis.status === "ignore" ||
    (analysis.importance === "low" && !analysis.requires_action && !openWorkflow)
  ) {
    labels.add("low_priority");
  }
  return MAILPILOT_LABELS.map((spec) => spec.logicalName).filter((name) => labels.has(name));
}

export function labelDiff(
  currentIds: string[],
  desiredIds: string[],
): {
  addLabelIds: string[];
  removeLabelIds: string[];
} {
  const current = new Set(currentIds);
  const desired = new Set(desiredIds);
  return {
    addLabelIds: desiredIds.filter((id) => !current.has(id)),
    removeLabelIds: currentIds.filter((id) => !desired.has(id)),
  };
}
