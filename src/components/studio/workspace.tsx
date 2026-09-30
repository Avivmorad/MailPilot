"use client";

import { useMemo, useState } from "react";

import { Logo } from "@/components/brand/logo";
import { SkipToContent } from "@/components/layout/skip-to-content";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import {
  countLane,
  resolveVisibleSelection,
  STUDIO_ITEMS,
  type StudioItem,
  type StudioLane,
} from "@/lib/studio/fixtures";
import { cn } from "@/lib/utils";

const LANES: { id: StudioLane | "focus"; label: string; hint: string }[] = [
  { id: "focus", label: "Today", hint: "Due soon" },
  { id: "open", label: "Actions", hint: "Your move" },
  { id: "pending", label: "Pending", hint: "Their move" },
  { id: "fyi", label: "For You", hint: "No task" },
];

function visibleItems(items: StudioItem[], lane: StudioLane | "focus"): StudioItem[] {
  if (lane === "focus") {
    return items.filter((item) => item.lane === "open" && item.dueLabel);
  }
  return items.filter((item) => item.lane === lane);
}

export function StudioWorkspace() {
  const [items, setItems] = useState(STUDIO_ITEMS);
  const [lane, setLane] = useState<StudioLane | "focus">("focus");
  const [selectedId, setSelectedId] = useState(STUDIO_ITEMS[0]?.id ?? "");
  const [query, setQuery] = useState("");
  const [scanning, setScanning] = useState(true);

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    return visibleItems(items, lane).filter((item) =>
      q ? `${item.title} ${item.sender} ${item.preview}`.toLowerCase().includes(q) : true,
    );
  }, [items, lane, query]);

  const selected = resolveVisibleSelection(list, selectedId);

  function move(id: string, next: StudioLane) {
    setItems((current) => current.map((item) => (item.id === id ? { ...item, lane: next } : item)));
  }

  return (
    <div className="bg-background text-foreground flex min-h-full flex-col">
      <SkipToContent />
      <header className="border-border/80 flex items-center gap-4 border-b px-4 py-3 sm:px-6">
        <Logo />
        <p className="text-muted-foreground hidden text-sm md:block">
          Monday, Sep 28
          <span className="text-foreground mx-2 font-medium">
            {countLane(items, "open")} {countLane(items, "open") === 1 ? "action" : "actions"}
          </span>
          since the last scan
        </p>
        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            onClick={() => setScanning((value) => !value)}
            className="bg-primary text-primary-foreground focus-visible:ring-ring rounded-full px-4 py-2 text-sm font-medium focus-visible:ring-3 focus-visible:outline-none"
          >
            {scanning ? "Pause scan" : "Scan inbox"}
          </button>
          <ThemeToggle />
        </div>
      </header>
      {scanning ? (
        <div className="border-border/70 bg-card border-b px-4 py-2 sm:px-6">
          <div className="text-muted-foreground mb-1 flex justify-between text-xs">
            <span>Scanning 242 of 699 · saved · continues if this tab closes</span>
            <span>35%</span>
          </div>
          <div className="bg-muted h-1.5 overflow-hidden rounded-full" aria-hidden>
            <div className="bg-primary h-full w-[35%]" />
          </div>
        </div>
      ) : null}
      <main
        id="main-content"
        tabIndex={-1}
        className="grid min-h-0 flex-1 lg:grid-cols-[220px_minmax(0,1fr)_minmax(320px,400px)]"
      >
        <nav aria-label="Inbox lanes" className="border-border/70 space-y-1 border-r p-3">
          {LANES.map((item) => {
            const count =
              item.id === "focus"
                ? items.filter((row) => row.lane === "open" && row.dueLabel).length
                : countLane(items, item.id);
            return (
              <button
                key={item.id}
                type="button"
                aria-current={lane === item.id ? "page" : undefined}
                onClick={() => setLane(item.id)}
                className={cn(
                  "flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm",
                  lane === item.id ? "bg-muted font-medium" : "hover:bg-muted/60",
                )}
              >
                <span>
                  {item.label}
                  <span className="text-muted-foreground block text-xs font-normal">
                    {item.hint}
                  </span>
                </span>
                <span className="tabular-nums">{count}</span>
              </button>
            );
          })}
        </nav>
        <section className="border-border/70 min-w-0 border-r">
          <div className="p-3">
            <label className="sr-only" htmlFor="studio-search">
              Search this lane
            </label>
            <input
              id="studio-search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search sender or subject"
              className="border-input bg-card w-full rounded-xl border px-3 py-2 text-sm"
            />
          </div>
          <ul>
            {list.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => setSelectedId(item.id)}
                  className={cn(
                    "hover:bg-muted/50 w-full px-4 py-3 text-left",
                    selected?.id === item.id && "bg-accent",
                  )}
                >
                  <span className="flex items-baseline justify-between gap-3">
                    <span className="font-medium">{item.sender}</span>
                    <span className="text-muted-foreground text-xs">{item.when}</span>
                  </span>
                  <span className="mt-0.5 block text-sm">{item.title}</span>
                  <span className="text-muted-foreground mt-1 block text-sm">{item.preview}</span>
                  {item.dueLabel ? (
                    <span className="text-destructive mt-2 inline-flex text-xs font-medium">
                      {item.dueLabel}
                    </span>
                  ) : null}
                </button>
              </li>
            ))}
            {list.length === 0 ? (
              <li className="text-muted-foreground px-4 py-8 text-sm">Nothing in this lane.</li>
            ) : null}
          </ul>
        </section>
        <aside className="min-w-0 p-5">
          {selected ? (
            <article>
              <p className="text-muted-foreground text-xs tracking-wide uppercase">
                {selected.category}
              </p>
              <h1 className="mt-1 text-2xl font-semibold tracking-tight">{selected.title}</h1>
              <p className="text-muted-foreground mt-1 text-sm">
                {selected.sender} · {selected.address}
              </p>
              <div className="border-primary/30 bg-primary/5 mt-5 rounded-2xl border p-4">
                <p className="text-primary text-xs font-semibold tracking-wide uppercase">
                  Next step
                </p>
                <p className="mt-1 text-sm leading-6">{selected.nextStep}</p>
              </div>
              <p className="text-muted-foreground mt-4 text-sm leading-6">{selected.why}</p>
              <div className="mt-5 flex flex-wrap gap-2">
                {selected.lane === "open" ? (
                  <>
                    <button
                      type="button"
                      className="bg-primary text-primary-foreground rounded-full px-3 py-1.5 text-sm"
                      onClick={() => move(selected.id, "pending")}
                    >
                      I replied
                    </button>
                    <button
                      type="button"
                      className="border-border rounded-full border px-3 py-1.5 text-sm"
                      onClick={() => move(selected.id, "snoozed")}
                    >
                      Snooze
                    </button>
                  </>
                ) : null}
                <a
                  className="border-border rounded-full border px-3 py-1.5 text-sm"
                  href="https://mail.google.com"
                  target="_blank"
                  rel="noreferrer"
                >
                  Open in Gmail
                </a>
              </div>
              <h2 className="mt-8 text-sm font-semibold">What we kept</h2>
              <ul className="mt-2 space-y-3">
                {selected.messages.map((message) => (
                  <li key={message.at} className="text-sm leading-6">
                    <span className="text-muted-foreground block text-xs">{message.at}</span>
                    {message.text}
                  </li>
                ))}
              </ul>
            </article>
          ) : (
            <p className="text-muted-foreground text-sm">Select a thread.</p>
          )}
        </aside>
      </main>
    </div>
  );
}
