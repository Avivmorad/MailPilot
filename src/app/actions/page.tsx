import Link from "next/link";
import { redirect } from "next/navigation";

import { GroupedActionList } from "@/components/actions/grouped-action-list";
import { AppShell } from "@/components/layout/app-shell";
import { EmptyState } from "@/components/layout/empty-state";
import { PageHeader } from "@/components/layout/page-header";
import { AppHeader } from "@/components/nav/app-header";
import { listActionsForUser } from "@/lib/actions/queries";
import { isActionTab } from "@/lib/actions/sort";
import { getSessionUser } from "@/lib/supabase/auth";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const TABS = [
  { id: "OPEN", label: "Open" },
  { id: "WAITING", label: "Waiting" },
  { id: "COMPLETED", label: "Done" },
  { id: "SNOOZED", label: "Snoozed" },
] as const;

export default async function ActionsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const user = await getSessionUser();
  if (!user) {
    redirect("/login");
  }
  const params = await searchParams;
  const tab = isActionTab(params.tab) ? params.tab : "OPEN";
  const items = await listActionsForUser(user.id, tab);

  return (
    <AppShell header={<AppHeader email={user.email} current="actions" />} width="narrow">
      <PageHeader
        title="Action Center"
        description="Open is a task list, grouped by topic. Inbox summaries live on the dashboard."
      />
      <div className="bg-muted/70 flex flex-wrap gap-1 rounded-xl p-1">
        {TABS.map((item) => (
          <Link
            key={item.id}
            href={`/actions?tab=${item.id}`}
            aria-current={tab === item.id ? "page" : undefined}
            className={cn(
              "rounded-lg px-3 py-1.5 text-sm transition-colors",
              tab === item.id
                ? "bg-background text-foreground font-medium shadow-xs"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {item.label}
          </Link>
        ))}
      </div>
      {items.length === 0 ? (
        <EmptyState
          title="Nothing in this list yet"
          description="Run a scan from the dashboard, then come back to work through tasks."
        />
      ) : (
        <GroupedActionList
          items={items}
          storageKey={`actions-${tab.toLowerCase()}`}
          emptyTitle="Nothing in this list yet"
          emptyDescription="Run a scan from the dashboard, then come back to work through tasks."
        />
      )}
    </AppShell>
  );
}
