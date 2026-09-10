import { redirect } from "next/navigation";

import { GmailConnectionCard } from "@/components/gmail/gmail-connection-card";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { getGmailStatusForUser } from "@/lib/gmail/connections";
import { getSessionUser } from "@/lib/supabase/auth";

export const dynamic = "force-dynamic";

const stats = [
  { label: "Processed", value: "—" },
  { label: "Important", value: "—" },
  { label: "Need action", value: "—" },
  { label: "Waiting", value: "—" },
];

export default async function DashboardPage({
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
            <a href="/settings" className="text-muted-foreground text-sm hover:underline">
              Settings
            </a>
            <span className="text-muted-foreground hidden text-sm sm:inline">{user.email}</span>
            <form action="/auth/signout" method="post">
              <Button type="submit" variant="outline" size="sm">
                Sign out
              </Button>
            </form>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-10">
        <div className="mb-8">
          <h1 className="text-2xl font-semibold tracking-tight">Inbox overview</h1>
          <p className="text-muted-foreground mt-1">
            {gmailStatus.connection?.status === "CONNECTED"
              ? "Gmail is connected. Scanning arrives in a later phase."
              : "Connect Gmail to start triaging your inbox."}
          </p>
        </div>

        <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
          {stats.map((stat) => (
            <Card key={stat.label}>
              <CardContent className="pt-6">
                <div className="text-3xl font-semibold tabular-nums">{stat.value}</div>
                <div className="text-muted-foreground mt-1 text-sm">{stat.label}</div>
              </CardContent>
            </Card>
          ))}
        </div>

        <GmailConnectionCard status={gmailStatus} gmailFlash={params.gmail} reason={params.reason} />
      </main>
    </div>
  );
}
