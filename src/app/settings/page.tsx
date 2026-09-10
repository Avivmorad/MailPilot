import { redirect } from "next/navigation";

import { GmailConnectionCard } from "@/components/gmail/gmail-connection-card";
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
    <div className="flex min-h-full flex-col">
      <AppHeader email={user.email} current="settings" />
      <main className="mx-auto w-full max-w-xl flex-1 px-6 py-10">
        <h1 className="mb-6 text-2xl font-semibold tracking-tight">Settings</h1>
        <GmailConnectionCard status={gmailStatus} gmailFlash={params.gmail} reason={params.reason} />
      </main>
    </div>
  );
}
