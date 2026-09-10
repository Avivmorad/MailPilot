import { redirect } from "next/navigation";

import { GmailConnectionCard } from "@/components/gmail/gmail-connection-card";
import { InitialScanCard } from "@/components/scans/initial-scan-card";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { getGmailStatusForUser } from "@/lib/gmail/connections";
import { getInboxCountsForUser, getLatestScanRunForUser } from "@/lib/scans/manual";
import { getSessionUser } from "@/lib/supabase/auth";

export const dynamic = "force-dynamic";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ gmail?: string; reason?: string; scan?: string }>;
}) {
  const user = await getSessionUser();
  if (!user) {
    redirect("/login");
  }

  const params = await searchParams;
  const gmailStatus = await getGmailStatusForUser(user.id);
  const connected = gmailStatus.connection?.status === "CONNECTED";
  const counts = connected
    ? await getInboxCountsForUser(user.id)
    : { processed: 0, important: 0, needAction: 0, waiting: 0 };
  const latestScan = connected ? await getLatestScanRunForUser(user.id) : null;

  const stats = [
    { label: "Processed", value: connected ? String(counts.processed) : "—" },
    { label: "Important", value: connected ? String(counts.important) : "—" },
    { label: "Need action", value: connected ? String(counts.needAction) : "—" },
    { label: "Waiting", value: connected ? String(counts.waiting) : "—" },
  ];

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
            {connected
              ? params.scan === "done"
                ? "Scan finished. Counts below are from the database."
                : latestScan
                ? `Last scan: ${String(latestScan.status).toLowerCase()}.`
                : "Gmail is connected. Run an initial scan of the last 7 days."
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

        <div className="grid gap-6 lg:grid-cols-2">
          <GmailConnectionCard status={gmailStatus} gmailFlash={params.gmail} reason={params.reason} />
          <InitialScanCard connected={connected} />
        </div>
      </main>
    </div>
  );
}
