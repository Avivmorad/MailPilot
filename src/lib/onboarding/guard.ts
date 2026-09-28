import { redirect } from "next/navigation";

import { getOnboardingStepForUser } from "@/lib/onboarding/load";

/** Redirect incomplete setups to onboarding before Mail / Digests / Settings. */
export async function requireOnboardingComplete(userId: string): Promise<void> {
  const step = await getOnboardingStepForUser(userId);
  if (step !== "complete") {
    redirect("/onboarding");
  }
}
