import type { MailTab } from "@/lib/mail/tabs";

/**
 * Card fills use the same hue as the tab's status chip, stronger than the chip
 * so the row reads in color. Snoozed has no status chip; indigo stays distinct
 * from For You (sky), Actions (red), Pending (amber), Closed (green), and
 * Ignored (zinc). Selected state is a deeper fill and a solid border — no glow.
 */
const TAB_CARD_TONE: Record<MailTab, { idle: string; selected: string }> = {
  summary: {
    idle: "border-2 border-sky-800/40 bg-sky-300 text-sky-950 hover:bg-sky-400 dark:border-sky-200/45 dark:bg-sky-700 dark:text-sky-50 dark:hover:bg-sky-600",
    selected:
      "border-2 border-sky-950 bg-sky-700 text-white hover:bg-sky-800 dark:border-white dark:bg-sky-300 dark:text-sky-950 dark:hover:bg-sky-200",
  },
  open: {
    idle: "border-2 border-red-800/40 bg-red-300 text-red-950 hover:bg-red-400 dark:border-red-200/45 dark:bg-red-800 dark:text-red-50 dark:hover:bg-red-700",
    selected:
      "border-2 border-red-950 bg-red-700 text-white hover:bg-red-800 dark:border-white dark:bg-red-400 dark:text-red-950 dark:hover:bg-red-300",
  },
  waiting: {
    idle: "border-2 border-amber-800/40 bg-amber-300 text-amber-950 hover:bg-amber-400 dark:border-amber-200/45 dark:bg-amber-700 dark:text-amber-50 dark:hover:bg-amber-600",
    selected:
      "border-2 border-amber-950 bg-amber-600 text-amber-50 hover:bg-amber-700 dark:border-white dark:bg-amber-300 dark:text-amber-950 dark:hover:bg-amber-200",
  },
  completed: {
    idle: "border-2 border-green-800/40 bg-green-300 text-green-950 hover:bg-green-400 dark:border-green-200/45 dark:bg-green-800 dark:text-green-50 dark:hover:bg-green-700",
    selected:
      "border-2 border-green-950 bg-green-700 text-white hover:bg-green-800 dark:border-white dark:bg-green-400 dark:text-green-950 dark:hover:bg-green-300",
  },
  snoozed: {
    idle: "border-2 border-indigo-800/40 bg-indigo-300 text-indigo-950 hover:bg-indigo-400 dark:border-indigo-200/45 dark:bg-indigo-800 dark:text-indigo-50 dark:hover:bg-indigo-700",
    selected:
      "border-2 border-indigo-950 bg-indigo-700 text-white hover:bg-indigo-800 dark:border-white dark:bg-indigo-300 dark:text-indigo-950 dark:hover:bg-indigo-200",
  },
  ignored: {
    idle: "border-2 border-zinc-700/45 bg-zinc-400 text-zinc-950 hover:bg-zinc-500 dark:border-zinc-200/40 dark:bg-zinc-600 dark:text-zinc-50 dark:hover:bg-zinc-500",
    selected:
      "border-2 border-zinc-950 bg-zinc-700 text-white hover:bg-zinc-800 dark:border-white dark:bg-zinc-300 dark:text-zinc-950 dark:hover:bg-zinc-200",
  },
};

export function mailTabCardClass(tab: MailTab, selected: boolean): string {
  const tone = TAB_CARD_TONE[tab];
  return selected ? tone.selected : tone.idle;
}
