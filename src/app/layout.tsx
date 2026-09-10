import type { Metadata } from "next";
import { Assistant, Geist, Geist_Mono } from "next/font/google";
import type { ReactNode } from "react";

import { ThemeSync } from "@/components/theme/theme-sync";
import { THEME_INIT_SCRIPT } from "@/lib/ui/theme";

import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const assistant = Assistant({
  variable: "--font-assistant",
  subsets: ["latin", "hebrew"],
  weight: ["400", "500", "600", "700"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "MailPilot",
  description:
    "Turn your inbox into a triage system that tells you what happened, what needs you, and what you're waiting for.",
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${assistant.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
        <ThemeSync />
        {children}
      </body>
    </html>
  );
}
