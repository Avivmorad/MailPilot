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
 * Product-facing MailPilot labels (docs/PRODUCT_DECISIONS.md).
 * Created on first connect if missing; mapping stored in gmail_labels.
 */
export const MAILPILOT_LABELS = [
  { logicalName: "important", gmailLabelName: "MailPilot/Important" },
  { logicalName: "action_required", gmailLabelName: "MailPilot/Action Required" },
  { logicalName: "low_priority", gmailLabelName: "MailPilot/Low Priority" },
  { logicalName: "processed", gmailLabelName: "MailPilot/Processed" },
] as const;

export type MailPilotLogicalLabel = (typeof MAILPILOT_LABELS)[number]["logicalName"];

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
