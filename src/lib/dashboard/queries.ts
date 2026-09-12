import {
  formatDashboardChangeLine,
  summarizeDashboardChanges,
  type ActionChangeRow,
  type DashboardChangeSummary,
} from "@/lib/dashboard/changes";
import { createAdminClient } from "@/lib/supabase/admin";

export async function getDashboardChangesForUser(
  userId: string,
  since: string | null,
  now: Date = new Date(),
): Promise<{ summary: DashboardChangeSummary; line: string | null }> {
  const db = createAdminClient();
  const { data, error } = await db
    .from("action_items")
    .select("status, created_at, updated_at, deadline")
    .eq("user_id", userId);
  const rows: ActionChangeRow[] = error || !data
    ? []
    : data.map((row) => ({
        status: String(row.status ?? ""),
        createdAt: typeof row.created_at === "string" ? row.created_at : "",
        updatedAt: typeof row.updated_at === "string" ? row.updated_at : "",
        deadline: typeof row.deadline === "string" ? row.deadline : null,
      }));
  const summary = summarizeDashboardChanges(rows, since, now);
  return { summary, line: formatDashboardChangeLine(summary) };
}
