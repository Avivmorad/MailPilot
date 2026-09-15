import type { Metadata } from "next";
import type { ReactNode } from "react";

import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";

import { ThemeSync } from "@/components/theme/theme-sync";
import { THEME_INIT_SCRIPT } from "@/lib/ui/theme";

import "./globals.css";

export const metadata: Metadata = {
  title: "MailPilot",
  description:
    "Turn your inbox into a triage system that tells you what happened, what needs you, and what's pending.",
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning className="h-full antialiased">
      <body className="flex min-h-full flex-col">
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
        <ThemeSync />
        {children}
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
