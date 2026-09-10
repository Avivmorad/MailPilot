import { redirect } from "next/navigation";

import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getSessionUser } from "@/lib/supabase/auth";

// Auth depends on request cookies, so this page must never be prerendered.
export const dynamic = "force-dynamic";

const stats = [
  { label: "Processed", value: "—" },
  { label: "Important", value: "—" },
  { label: "Need action", value: "—" },
  { label: "Waiting", value: "—" },
];

export default async function DashboardPage() {
  const user = await getSessionUser();
  if (!user) {
    redirect("/login");
  }

  return (
    <div className="flex min-h-full flex-col">
      <header className="border-border/60 border-b">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-4">
          <Logo />
          <div className="flex items-center gap-3">
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
            You&apos;re signed in. Connect Gmail to start triaging — coming in a later phase.
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

        <Card>
          <CardHeader>
            <CardTitle>Connect Gmail</CardTitle>
            <CardDescription>
              MailPilot will scan the last 7 days, then run daily at 08:00 (Asia/Jerusalem),
              analyzing only what changed since the last successful scan.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button disabled>Connect Gmail (coming soon)</Button>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
