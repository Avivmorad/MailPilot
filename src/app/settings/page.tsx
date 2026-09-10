import { redirect } from "next/navigation";

import { GmailConnectionCard } from "@/components/gmail/gmail-connection-card";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
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
      <header className="border-border/60 border-b">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-4">
          <Logo />
          <div className="flex items-center gap-3">
            <a href="/dashboard" className="text-muted-foreground text-sm hover:underline">
              Dashboard
            </a>
            <form action="/auth/signout" method="post">
              <Button type="submit" variant="outline" size="sm">
                Sign out
              </Button>
            </form>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-xl flex-1 px-6 py-10">
        <h1 className="mb-6 text-2xl font-semibold tracking-tight">Settings</h1>
        <GmailConnectionCard status={gmailStatus} gmailFlash={params.gmail} reason={params.reason} />
      </main>
    </div>
  );
}
