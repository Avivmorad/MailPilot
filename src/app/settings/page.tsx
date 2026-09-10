import { redirect } from "next/navigation";

import { GmailConnectionCard } from "@/components/gmail/gmail-connection-card";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { AppHeader } from "@/components/nav/app-header";
import { getGmailStatusForUser } from "@/lib/gmail/connections";
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
  const gmailStatus = await getGmailStatusForUser(user.id);

  return (
    <AppShell header={<AppHeader email={user.email} current="settings" />} width="narrow">
      <PageHeader
        title="Settings"
        description="Connect or reconnect Gmail. MailPilot only manages labels in the MailPilot/ namespace."
      />
      <GmailConnectionCard status={gmailStatus} gmailFlash={params.gmail} reason={params.reason} />
    </AppShell>
  );
}
