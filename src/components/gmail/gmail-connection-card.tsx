import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { GmailStatusPayload } from "@/lib/gmail/constants";

function flashMessage(gmail: string | undefined, reason: string | undefined): {
  kind: "ok" | "error";
  text: string;
} | null {
  if (gmail === "connected") {
    return { kind: "ok", text: "Gmail connected. MailPilot labels are ready in your mailbox." };
  }
  if (gmail === "disconnected") {
    return { kind: "ok", text: "Gmail disconnected. Historical summaries were kept." };
  }
  if (gmail !== "error") {
    return null;
  }

  const messages: Record<string, string> = {
    not_configured:
      "Gmail OAuth is not configured. Add GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI, and TOKEN_ENCRYPTION_KEY to .env.local.",
    denied: "Gmail access was not granted. You can try connecting again.",
    invalid_state: "The Gmail connection request expired. Please try again.",
    not_signed_in: "Sign in to MailPilot, then connect Gmail.",
    missing_code: "Google did not return an authorization code. Please try again.",
    no_refresh_token:
      "Google did not return a refresh token. Remove MailPilot from your Google account permissions and connect again.",
    gmail_api:
      "Gmail API is not enabled (or profile lookup failed). In Google Cloud enable Gmail API, wait a minute, then try Connect Gmail again.",
    gmail_profile: "Google did not return a Gmail address for this account.",
    persist:
      "Could not save the Gmail connection. Apply supabase/migrations/0002_gmail_connections.sql in the SQL Editor, then try again.",
    encryption_key:
      "TOKEN_ENCRYPTION_KEY is invalid. It must be 64 hex characters from `openssl rand -hex 32`. Update .env.local and restart.",
    token_exchange: "Google token exchange failed. Try Connect Gmail again.",
    connect_failed: "Gmail could not be connected. Please try again.",
    disconnect_failed: "Gmail could not be disconnected. Please try again.",
    invalid_request: "The Gmail callback was invalid. Please try again.",
  };

  return {
    kind: "error",
    text: messages[reason ?? ""] ?? "Gmail connection needs attention. Please try again.",
  };
}

function statusCopy(status: GmailStatusPayload): { title: string; body: string } {
  if (status.loadError) {
    return {
      title: "Could not load Gmail status",
      body: status.loadError,
    };
  }

  if (!status.configured) {
    return {
      title: "Gmail is not configured yet",
      body: "Add the Google OAuth values to .env.local, then restart the dev server.",
    };
  }

  const connection = status.connection;
  if (!connection || connection.status === "DISCONNECTED") {
    return {
      title: "Connect Gmail",
      body: "MailPilot can scan up to the last month. You choose the window. Daily incremental scans come later.",
    };
  }

  if (connection.status === "REAUTH_REQUIRED") {
    return {
      title: "Gmail connection expired",
      body: "Reconnect Gmail to continue scanning. Your existing summaries were not deleted.",
    };
  }

  if (connection.status === "ERROR") {
    return {
      title: "Gmail connection error",
      body: `Connected account: ${connection.gmailEmail}. Reconnect to repair the connection.`,
    };
  }

  return {
    title: "Gmail connected",
    body: `Connected as ${connection.gmailEmail}. MailPilot labels are managed automatically.`,
  };
}

export function GmailConnectionCard({
  status,
  gmailFlash,
  reason,
}: {
  status: GmailStatusPayload;
  gmailFlash?: string;
  reason?: string;
}) {
  const copy = statusCopy(status);
  const flash = flashMessage(gmailFlash, reason);
  const connection = status.connection;
  const isActive = connection?.status === "CONNECTED";
  const needsReconnect =
    connection?.status === "REAUTH_REQUIRED" || connection?.status === "ERROR";
  const canConnect = status.configured && !status.loadError;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{copy.title}</CardTitle>
        <CardDescription>{copy.body}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {flash ? (
          <p className={flash.kind === "error" ? "text-destructive text-sm" : "text-sm"}>{flash.text}</p>
        ) : null}

        <div className="flex flex-wrap gap-2">
          {canConnect && !isActive ? (
            <a href="/api/gmail/connect" className={buttonVariants()}>
              {needsReconnect ? "Reconnect Gmail" : "Connect Gmail"}
            </a>
          ) : null}

          {canConnect && isActive ? (
            <>
              <a href="/api/gmail/connect" className={buttonVariants({ variant: "outline" })}>
                Reconnect
              </a>
              <form action="/api/gmail/disconnect" method="post">
                <Button type="submit" variant="destructive">
                  Disconnect Gmail
                </Button>
              </form>
            </>
          ) : null}

          {!canConnect ? (
            <Button type="button" disabled>
              Connect Gmail
            </Button>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
