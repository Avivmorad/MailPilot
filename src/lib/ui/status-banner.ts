export type AppBannerKind = "info" | "warning" | "error";

export interface AppBanner {
  kind: AppBannerKind;
  title: string;
  body: string;
  href?: string;
  actionLabel?: string;
}

export function appStatusBanner(input: {
  connectionStatus: string | null;
  scanStatus: string | null;
  errorCode?: string | null;
  suppressRunning?: boolean;
}): AppBanner | null {
  if (input.connectionStatus === "REAUTH_REQUIRED") {
    return {
      kind: "warning",
      title: "Your Gmail connection needs to be refreshed.",
      body: "Reconnect Gmail to continue scanning. Your existing summaries were kept.",
      href: "/api/gmail/connect",
      actionLabel: "Reconnect Gmail",
    };
  }
  if (input.connectionStatus === "ERROR") {
    return {
      kind: "error",
      title: "Gmail connection error",
      body: "Reconnect to repair the connection. Your existing summaries were not deleted.",
      href: "/api/gmail/connect",
      actionLabel: "Reconnect Gmail",
    };
  }
  if (input.scanStatus === "FAILED") {
    if (input.errorCode === "reauth_required") {
      return {
        kind: "warning",
        title: "Your Gmail connection needs to be refreshed.",
        body: "Reconnect Gmail to continue scanning. Your existing summaries were kept.",
        href: "/api/gmail/connect",
        actionLabel: "Reconnect Gmail",
      };
    }
    if (input.errorCode === "gmail_quota") {
      return {
        kind: "error",
        title: "Gmail quota paused this scan.",
        body: "Wait a minute and try a shorter lookback. Your existing summaries were kept.",
        href: "/dashboard",
        actionLabel: "Go to dashboard",
      };
    }
    if (input.errorCode === "ai_unavailable") {
      return {
        kind: "error",
        title: "Email analysis is temporarily unavailable.",
        body: "Try again in a few minutes. Your existing summaries were kept.",
        href: "/dashboard",
        actionLabel: "Go to dashboard",
      };
    }
    return {
      kind: "error",
      title: "The last scan failed.",
      body: "Try Scan now on the dashboard. Your existing summaries were kept.",
      href: "/dashboard",
      actionLabel: "Go to dashboard",
    };
  }
  if (input.scanStatus === "PARTIAL") {
    return {
      kind: "warning",
      title: "Most emails were processed, but a few could not be analyzed.",
      body: "The system will retry them.",
    };
  }
  if (input.scanStatus === "RUNNING" && !input.suppressRunning) {
    return {
      kind: "info",
      title: "A scan is running.",
      body: "You can keep using MailPilot while it works.",
      href: "/dashboard",
      actionLabel: "View progress",
    };
  }
  return null;
}
