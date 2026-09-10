import { redirect } from "next/navigation";

import { GroupedActionList } from "@/components/actions/grouped-action-list";
import { ActionItemCard } from "@/components/actions/action-item-card";
import { AppHeader } from "@/components/nav/app-header";
import { listActionsForUser } from "@/lib/actions/queries";
import { isActionTab } from "@/lib/actions/sort";
import { getSessionUser } from "@/lib/supabase/auth";

export const dynamic = "force-dynamic";

const TABS = [
  { id: "OPEN", label: "Open" },
  { id: "WAITING", label: "Waiting" },
  { id: "COMPLETED", label: "Completed" },
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
    <div className="flex min-h-full flex-col">
      <AppHeader email={user.email} current="actions" />
      <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-10">
        <h1 className="text-2xl font-semibold tracking-tight">Action Center</h1>
        <p className="text-muted-foreground mt-1 mb-6 text-sm">
          Open is a task list, grouped by topic. Inbox summaries live on the dashboard — not here.
        </p>
        <div className="mb-6 flex flex-wrap gap-2">
          {TABS.map((item) => (
            <a
              key={item.id}
              href={`/actions?tab=${item.id}`}
              className={
                tab === item.id
                  ? "bg-primary text-primary-foreground rounded-lg px-3 py-1 text-sm"
                  : "bg-muted rounded-lg px-3 py-1 text-sm"
              }
            >
              {item.label}
            </a>
          ))}
        </div>
        {items.length === 0 ? (
          <p className="text-muted-foreground text-sm">Nothing in this list yet. Run a scan from the dashboard.</p>
        ) : tab === "OPEN" ? (
          <GroupedActionList items={items} />
        ) : (
          <div className="space-y-4">
            {items.map((item) => (
              <ActionItemCard key={item.id} item={item} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
