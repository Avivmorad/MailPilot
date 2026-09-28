import { redirect } from "next/navigation";

import { StudioWorkspace } from "@/components/studio/workspace";
import { requireOnboardingComplete } from "@/lib/onboarding/guard";
import { getSessionUser } from "@/lib/supabase/auth";

export const dynamic = "force-dynamic";

export default async function StudioPage() {
  const user = await getSessionUser();
  if (!user) {
    redirect("/login");
  }
  await requireOnboardingComplete(user.id);
  return <StudioWorkspace />;
}
