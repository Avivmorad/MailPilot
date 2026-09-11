import Link from "next/link";
import { redirect } from "next/navigation";

import { DigestReportCard } from "@/components/digest/digest-report-card";
import { AppChrome } from "@/components/layout/app-chrome";
import { PageHeader } from "@/components/layout/page-header";
import { ensureDigestForLatestScan } from "@/lib/digest/build-digest";
import { listDigestsForUser } from "@/lib/digest/queries";
import { getLatestScanRunForUser } from "@/lib/scans/manual";
import { getSessionUser } from "@/lib/supabase/auth";

export const dynamic = "force-dynamic";

export default async function DigestsPage() {
  const user = await getSessionUser();
  if (!user) {
    redirect("/login");
  }

  const latestScan = await getLatestScanRunForUser(user.id);
  await ensureDigestForLatestScan(
    user.id,
    latestScan ? String(latestScan.id) : null,
    latestScan ? String(latestScan.status) : null,
  ).catch(() => null);
  const digests = await listDigestsForUser(user.id, 20).catch(() => []);

  return (
    <AppChrome user={user} current="digests" width="narrow">
      <PageHeader
        title="Digests"
        description="In-app history of period counts and top open tasks after each successful scan. Email delivery is not in the MVP."
      />
      {digests.length === 0 ? (
        <DigestReportCard digest={null} title="Digest history" />
      ) : (
        <div className="space-y-6">
          {digests.map((digest, index) => (
            <DigestReportCard
              key={digest.id}
              digest={digest}
              title={index === 0 ? "Latest digest" : "Earlier digest"}
            />
          ))}
        </div>
      )}
      <p className="text-muted-foreground text-sm">
        Open tasks live under{" "}
        <Link href="/mail?tab=open" className="text-primary font-medium hover:underline">
          Mail
        </Link>
        . Scan again from the dashboard to refresh these numbers.
      </p>
    </AppChrome>
  );
}
