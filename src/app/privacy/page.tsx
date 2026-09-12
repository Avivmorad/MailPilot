import type { Metadata } from "next";
import Link from "next/link";

import { PublicLegalShell } from "@/components/layout/public-legal-shell";
import { PRIVACY_POLICY_SECTIONS } from "@/lib/privacy/public-policy";

export const metadata: Metadata = {
  title: "Privacy — MailPilot",
  description:
    "How MailPilot uses Gmail, what it stores, and how you can delete analysis data or your account.",
};

export default function PrivacyPage() {
  return (
    <PublicLegalShell>
      <h1 className="text-foreground text-3xl font-bold tracking-tight">
        Privacy and Gmail data use
      </h1>
      <p className="text-muted-foreground mt-3 text-sm">
        This page describes how MailPilot handles Gmail for the current product. It is the public
        explanation Google OAuth verification expects, not legal advice.
      </p>
      <div className="mt-8 space-y-8">
        {PRIVACY_POLICY_SECTIONS.map((section) => (
          <section key={section.id} aria-labelledby={section.id}>
            <h2 id={section.id} className="text-foreground text-lg font-semibold tracking-tight">
              {section.title}
            </h2>
            <p className="text-muted-foreground mt-2 text-sm leading-relaxed">{section.body}</p>
          </section>
        ))}
      </div>
      <p className="text-muted-foreground mt-10 text-sm">
        Signed-in controls live in{" "}
        <Link href="/settings" className="text-foreground font-medium underline underline-offset-4">
          Settings
        </Link>
        . Product terms are at{" "}
        <Link href="/terms" className="text-foreground font-medium underline underline-offset-4">
          Terms
        </Link>
        .
      </p>
    </PublicLegalShell>
  );
}
