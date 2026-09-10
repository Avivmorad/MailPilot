"use client";

import { useEffect } from "react";

import { applyTheme, parseStoredTheme, THEME_STORAGE_KEY } from "@/lib/ui/theme";

export function ThemeSync() {
  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      if (parseStoredTheme(window.localStorage.getItem(THEME_STORAGE_KEY)) === "system") {
        applyTheme("system");
      }
    };
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);
  return null;
}
