"use client";

import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { applyTheme } from "@/lib/ui/theme";

export function ThemeToggle({ className }: { className?: string }) {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    setDark(document.documentElement.classList.contains("dark"));
  }, []);

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      className={className}
      aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
      title={dark ? "Light mode" : "Dark mode"}
      onClick={() => setDark(applyTheme(dark ? "light" : "dark"))}
    >
      {dark ? <Sun /> : <Moon />}
    </Button>
  );
}
