/** @vitest-environment jsdom */

import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ThemeSync } from "@/components/theme/theme-sync";
import { THEME_STORAGE_KEY } from "@/lib/ui/theme";

afterEach(() => {
  cleanup();
  window.localStorage.clear();
  document.documentElement.className = "";
  document.documentElement.style.colorScheme = "";
  vi.restoreAllMocks();
});

describe("ThemeSync", () => {
  it("restores a stored dark preference after a hydration className wipe", () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, "dark");
    // Bootstrap script would have set this before React hydrated.
    document.documentElement.classList.add("dark");
    document.documentElement.style.colorScheme = "dark";
    // React hydration replacing html className wipes sibling theme classes.
    document.documentElement.setAttribute("class", "h-full antialiased");
    expect(document.documentElement.classList.contains("dark")).toBe(false);

    render(<ThemeSync />);

    expect(document.documentElement.classList.contains("dark")).toBe(true);
    expect(document.documentElement.style.colorScheme).toBe("dark");
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe("dark");
  });

  it("re-applies stored light preference after hydration wipes classes", () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, "light");
    document.documentElement.classList.add("dark");
    document.documentElement.setAttribute("class", "h-full antialiased");

    render(<ThemeSync />);

    expect(document.documentElement.classList.contains("dark")).toBe(false);
    expect(document.documentElement.style.colorScheme).toBe("light");
  });

  it("does not follow system changes after the user picks light", () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, "light");
    document.documentElement.classList.remove("dark");

    const listeners = new Map<string, EventListener>();
    const media = {
      matches: false,
      media: "(prefers-color-scheme: dark)",
      addEventListener: (type: string, listener: EventListener) => {
        listeners.set(type, listener);
      },
      removeEventListener: (type: string) => {
        listeners.delete(type);
      },
    };
    vi.spyOn(window, "matchMedia").mockImplementation(() => media as MediaQueryList);

    render(<ThemeSync />);

    media.matches = true;
    listeners.get("change")?.(new Event("change"));

    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe("light");
    expect(document.documentElement.classList.contains("dark")).toBe(false);
  });
});
