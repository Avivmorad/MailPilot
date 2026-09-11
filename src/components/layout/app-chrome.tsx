import type { ReactNode } from "react";

import { AppShell } from "@/components/layout/app-shell";
import { StatusBanner } from "@/components/layout/status-banner";
import { AppHeader, type AppNavCurrent } from "@/components/nav/app-header";
import { getGmailStatusForUser } from "@/lib/gmail/connections";
import { getLatestScanRunForUser } from "@/lib/scans/manual";
import { appStatusBanner } from "@/lib/ui/status-banner";

export async function AppChrome({
  user,
  current,
  width = "wide",
  children,
}: {
  user: { id: string; email?: string | null };
  current: AppNavCurrent;
  width?: "wide" | "narrow";
  children: ReactNode;
}) {
  const [gmailStatus, latestScan] = await Promise.all([
    getGmailStatusForUser(user.id),
    getLatestScanRunForUser(user.id),
  ]);
  const banner = appStatusBanner({
    connectionStatus: gmailStatus.connection?.status ?? null,
    scanStatus: latestScan ? String(latestScan.status) : null,
    suppressRunning: current === "dashboard",
  });

  return (
    <AppShell
      header={<AppHeader email={user.email} current={current} />}
      banner={banner ? <StatusBanner {...banner} /> : null}
      width={width}
    >
      {children}
    </AppShell>
  );
}
