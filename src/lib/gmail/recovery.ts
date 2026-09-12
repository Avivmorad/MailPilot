import type { GmailStatusPayload } from "@/lib/gmail/constants";

/** True when the user cannot scan until they connect, reconnect, or fix config. */
export function shouldShowGmailRecoveryCard(status: GmailStatusPayload): boolean {
  if (status.loadError) {
    return true;
  }
  if (!status.configured) {
    return true;
  }
  const connection = status.connection;
  if (!connection) {
    return true;
  }
  return connection.status !== "CONNECTED";
}
