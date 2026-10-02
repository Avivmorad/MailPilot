import { redirect } from "next/navigation";

import { AppChrome } from "@/components/layout/app-chrome";
import { EmptyState } from "@/components/layout/empty-state";
import { PageHeader } from "@/components/layout/page-header";
import { UsageDayTable, UsageScanTable } from "@/components/usage/usage-tables";
import { listUsageByDayForUser, listUsageByScanForUser } from "@/lib/ai/usage-queries";
import { isUsageTelemetryUiEnabled } from "@/lib/config/features";
import { requireOnboardingComplete } from "@/lib/onboarding/guard";
import { getSessionUser } from "@/lib/supabase/auth";

export const dynamic = "force-dynamic";

/**
 * Operator Usage screen. Removable: feature flag + this folder + nav link.
 * Recording to triage_usage stays on when this UI is off.
 */
export default async function UsagePage() {
  if (!isUsageTelemetryUiEnabled()) {
    redirect("/mail");
  }

  const user = await getSessionUser();
  if (!user) {
    redirect("/login");
  }
  await requireOnboardingComplete(user.id);

  let dayRows: Awaited<ReturnType<typeof listUsageByDayForUser>> = [];
  let scanRows: Awaited<ReturnType<typeof listUsageByScanForUser>> = [];
  let loadFailed = false;
  try {
    [dayRows, scanRows] = await Promise.all([
      listUsageByDayForUser(user.id, 7),
      listUsageByScanForUser(user.id, 20),
    ]);
  } catch {
    loadFailed = true;
  }

  return (
    <AppChrome user={user} current="usage" width="narrow">
      <PageHeader
        title="Usage"
        description="Token counts from classification calls. No message content is stored here. Both free-tier providers price at $0."
      />
      {loadFailed ? (
        <EmptyState
          variant="error"
          title="Could not load usage"
          description="A temporary database error prevented loading classification usage."
        />
      ) : (
        <div className="space-y-10">
          <section className="space-y-3">
            <h2 className="text-foreground text-lg font-semibold tracking-tight">Last 7 days</h2>
            <UsageDayTable rows={dayRows} />
          </section>
          <section className="space-y-3">
            <h2 className="text-foreground text-lg font-semibold tracking-tight">Recent scans</h2>
            <UsageScanTable rows={scanRows} />
          </section>
        </div>
      )}
    </AppChrome>
  );
}
