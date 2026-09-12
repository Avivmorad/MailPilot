import type { ThreadAnalysis } from "@/lib/ai/schemas";
import { GMAILPILOT_LABELS, type GmailPilotLogicalLabel } from "@/lib/gmail/constants";

export function logicalLabelsForAnalysis(analysis: ThreadAnalysis): GmailPilotLogicalLabel[] {
  const labels = new Set<GmailPilotLogicalLabel>(["processed"]);
  if (analysis.importance === "high") {
    labels.add("important");
  }
  if (analysis.requires_action || analysis.status === "action_required") {
    labels.add("action_required");
  }
  if (
    analysis.status === "ignore" ||
    (analysis.importance === "low" && !analysis.requires_action)
  ) {
    labels.add("low_priority");
  }
  return GMAILPILOT_LABELS.map((spec) => spec.logicalName).filter((name) => labels.has(name));
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
