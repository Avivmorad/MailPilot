import { redirect } from "next/navigation";

import { mailTabFromLegacyActionTab } from "@/lib/mail/tabs";

export const dynamic = "force-dynamic";

export default async function ActionsRedirectPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const params = await searchParams;
  const tab = mailTabFromLegacyActionTab(params.tab);
  redirect(`/mail?tab=${tab}`);
}
