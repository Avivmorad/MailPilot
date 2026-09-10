"use client";

import { Moon, Sun } from "lucide-react";

import { Button } from "@/components/ui/button";
import { applyTheme } from "@/lib/ui/theme";

export function ThemeToggle({ className }: { className?: string }) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      className={className}
      aria-label="Toggle dark mode"
      title="Toggle dark mode"
      onClick={() => {
        const isDark = document.documentElement.classList.contains("dark");
        applyTheme(isDark ? "light" : "dark");
      }}
    >
      <Sun className="hidden dark:block" />
      <Moon className="dark:hidden" />
    </Button>
  );
}
