import type { Metadata } from "next";
import Link from "next/link";

import { PublicLegalShell } from "@/components/layout/public-legal-shell";
import { TERMS_SECTIONS } from "@/lib/privacy/public-terms";

export const metadata: Metadata = {
  title: "Terms — GmailPilot",
  description: "Terms for using GmailPilot and connecting Gmail.",
};

export default function TermsPage() {
  return (
    <PublicLegalShell>
      <h1 className="text-foreground text-3xl font-bold tracking-tight">Terms of use</h1>
      <p className="text-muted-foreground mt-3 text-sm">
        These terms describe the current GmailPilot product. They are not a substitute for legal
        advice. Privacy and Gmail data use are explained separately.
      </p>
      <div className="mt-8 space-y-8">
        {TERMS_SECTIONS.map((section) => (
          <section key={section.id} aria-labelledby={section.id}>
            <h2 id={section.id} className="text-foreground text-lg font-semibold tracking-tight">
              {section.title}
            </h2>
            <p className="text-muted-foreground mt-2 text-sm leading-relaxed">{section.body}</p>
          </section>
        ))}
      </div>
      <p className="text-muted-foreground mt-10 text-sm">
        See{" "}
        <Link href="/privacy" className="text-foreground font-medium underline underline-offset-4">
          privacy and Gmail data use
        </Link>
        .
      </p>
    </PublicLegalShell>
  );
}
