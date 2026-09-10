import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";

export function AppHeader({
  email,
  current,
}: {
  email?: string | null;
  current: "dashboard" | "actions" | "settings" | "thread";
}) {
  const linkClass = (href: "dashboard" | "actions" | "settings") =>
    current === href
      ? "text-foreground text-sm font-medium"
      : "text-muted-foreground text-sm hover:underline";

  return (
    <header className="border-border/60 border-b">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-4">
        <a href="/dashboard" className="hover:opacity-90">
          <Logo />
        </a>
        <nav className="flex items-center gap-4">
          <a href="/dashboard" className={linkClass("dashboard")}>
            Dashboard
          </a>
          <a href="/actions" className={linkClass("actions")}>
            Actions
          </a>
          <a href="/settings" className={linkClass("settings")}>
            Settings
          </a>
          {email ? <span className="text-muted-foreground hidden text-sm sm:inline">{email}</span> : null}
          <form action="/auth/signout" method="post">
            <Button type="submit" variant="outline" size="sm">
              Sign out
            </Button>
          </form>
        </nav>
      </div>
    </header>
  );
}
