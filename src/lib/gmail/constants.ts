export const GMAIL_MODIFY_SCOPE = "https://www.googleapis.com/auth/gmail.modify";

export const GMAIL_OAUTH_STATE_COOKIE = "gmail_oauth_state";

export const GMAIL_CONNECTION_STATUSES = [
  "CONNECTED",
  "REAUTH_REQUIRED",
  "DISCONNECTED",
  "ERROR",
] as const;

export type GmailConnectionStatus = (typeof GMAIL_CONNECTION_STATUSES)[number];

/**
 * Product-facing GmailPilot labels (docs/PRODUCT_DECISIONS.md).
 * Created on first connect if missing; mapping stored in gmail_labels.
 * Existing mailboxes may still have MailPilot/ names — lookup accepts both
 * and never creates a duplicate GmailPilot/ label when the legacy name exists.
 */
export const GMAILPILOT_LABELS = [
  {
    logicalName: "important",
    gmailLabelName: "GmailPilot/Important",
    legacyGmailLabelNames: ["MailPilot/Important"],
  },
  {
    logicalName: "action_required",
    gmailLabelName: "GmailPilot/Action Required",
    legacyGmailLabelNames: ["MailPilot/Action Required"],
  },
  {
    logicalName: "low_priority",
    gmailLabelName: "GmailPilot/Low Priority",
    legacyGmailLabelNames: ["MailPilot/Low Priority"],
  },
  {
    logicalName: "processed",
    gmailLabelName: "GmailPilot/Processed",
    legacyGmailLabelNames: ["MailPilot/Processed"],
  },
] as const;

export type GmailPilotLogicalLabel = (typeof GMAILPILOT_LABELS)[number]["logicalName"];
export type ManagedGmailLabelSpec = (typeof GMAILPILOT_LABELS)[number];

export function managedGmailLabelLookupNames(spec: ManagedGmailLabelSpec): readonly string[] {
  return [spec.gmailLabelName, ...spec.legacyGmailLabelNames];
}

export function resolveExistingManagedLabel(
  labelsByName: ReadonlyMap<string, string>,
  spec: ManagedGmailLabelSpec,
): { id: string; name: string } | null {
  for (const name of managedGmailLabelLookupNames(spec)) {
    const id = labelsByName.get(name);
    if (typeof id === "string") {
      return { id, name };
    }
  }
  return null;
}

export interface GmailConnectionPublic {
  id: string;
  gmailEmail: string;
  status: GmailConnectionStatus;
  lastSuccessfulScanAt: string | null;
  nextScanAt: string | null;
}

export interface GmailStatusPayload {
  configured: boolean;
  connection: GmailConnectionPublic | null;
  /** User-safe explanation when status could not be loaded. Never includes secrets. */
  loadError: string | null;
}
