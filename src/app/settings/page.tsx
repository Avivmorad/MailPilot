import { redirect } from "next/navigation";

import { GmailConnectionCard } from "@/components/gmail/gmail-connection-card";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { AppHeader } from "@/components/nav/app-header";
import { ScanHistoryList } from "@/components/scans/scan-history-list";
import { ScanPreferencesForm } from "@/components/settings/scan-preferences-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getGmailStatusForUser } from "@/lib/gmail/connections";
import { getScanRunsForUser } from "@/lib/scans/manual";
import { getScanPreferences } from "@/lib/settings/preferences";
import { getSessionUser } from "@/lib/supabase/auth";

export const dynamic = "force-dynamic";

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ gmail?: string; reason?: string }>;
}) {
  const user = await getSessionUser();
  if (!user) {
    redirect("/login");
  }

  const params = await searchParams;
  const [gmailStatus, preferences, scans] = await Promise.all([
    getGmailStatusForUser(user.id),
    getScanPreferences(user.id),
    getScanRunsForUser(user.id, 10),
  ]);

  return (
    <AppShell header={<AppHeader email={user.email} current="settings" />} width="narrow">
      <PageHeader
        title="Settings"
        description="Connect Gmail, set the daily scan time (default 08:00 Asia/Jerusalem), and review scan history."
      />
      <GmailConnectionCard status={gmailStatus} gmailFlash={params.gmail} reason={params.reason} />
      <ScanPreferencesForm dailyScanTime={preferences.dailyScanTime} timezone={preferences.timezone} />
      <ScanHistoryList
        scans={scans.map((scan) => ({
          id: String(scan.id),
          status: String(scan.status),
          trigger_type: String(scan.trigger_type),
          started_at: (scan.started_at as string | null) ?? null,
          finished_at: (scan.finished_at as string | null) ?? null,
          messages_processed: Number(scan.messages_processed ?? 0),
          threads_analyzed: Number(scan.threads_analyzed ?? 0),
        }))}
      />
      <Card>
        <CardHeader>
          <CardTitle>Digest</CardTitle>
          <CardDescription>
            After each successful scan, MailPilot stores an in-app digest of period counts and top
            open tasks. Sending that digest by email is not in the MVP.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-muted-foreground text-sm">
          History is on the Digests page. Open tasks stay on Mail.
        </CardContent>
      </Card>
    </AppShell>
  );
}
