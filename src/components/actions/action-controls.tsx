"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { MAX_SNOOZE_DAYS, SNOOZE_DAYS, type SnoozeDays } from "@/lib/actions/patch-schema";
import { formatDate } from "@/lib/ui/format";

function addCalendarDaysIso(days: number, now = new Date()): string {
  const next = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
  return next.toISOString().slice(0, 10);
}

export function ActionControls({
  actionId,
  status,
  waitingFor,
  snoozedUntil,
}: {
  actionId: string;
  status: string;
  waitingFor?: string | null;
  snoozedUntil?: string | null;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [customOpen, setCustomOpen] = useState(false);
  const [customDate, setCustomDate] = useState("");
  const [waitingDraft, setWaitingDraft] = useState(waitingFor ?? "");
  const minDate = useMemo(() => addCalendarDaysIso(1), []);
  const maxDate = useMemo(() => addCalendarDaysIso(MAX_SNOOZE_DAYS), []);

  async function patch(body: Record<string, unknown>) {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/actions/${actionId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { message?: string };
        setError(payload.message ?? "Update failed.");
        return;
      }
      setCustomOpen(false);
      router.refresh();
    } catch {
      setError("Update failed.");
    } finally {
      setBusy(false);
    }
  }

  const canSnooze = status !== "COMPLETED";
  const showUndo = status === "COMPLETED" || status === "SNOOZED";
  const showNeedsMe = status === "WAITING";

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        {status !== "COMPLETED" ? (
          <Button type="button" size="sm" disabled={busy} aria-busy={busy} onClick={() => void patch({ op: "complete" })}>
            Done
          </Button>
        ) : null}
        {showUndo ? (
          <Button type="button" size="sm" variant="outline" disabled={busy} aria-busy={busy} onClick={() => void patch({ op: "reopen" })}>
            Undo
          </Button>
        ) : null}
        {showNeedsMe ? (
          <Button type="button" size="sm" variant="outline" disabled={busy} aria-busy={busy} onClick={() => void patch({ op: "reopen" })}>
            Needs me
          </Button>
        ) : null}
        {canSnooze ? (
          <label className="text-muted-foreground flex items-center gap-1.5 text-sm">
            Snooze
            <select
              className="border-input bg-background h-7 rounded-lg border px-2 text-xs"
              disabled={busy}
              defaultValue=""
              aria-label="Snooze for"
              onChange={(event) => {
                const value = event.target.value;
                if (value === "custom") {
                  setCustomOpen(true);
                  event.currentTarget.value = "";
                  return;
                }
                const days = Number(value) as SnoozeDays;
                if ((SNOOZE_DAYS as readonly number[]).includes(days)) {
                  void patch({ op: "snooze", days });
                }
                event.currentTarget.value = "";
              }}
            >
              <option value="" disabled>
                Choose days
              </option>
              {SNOOZE_DAYS.map((days) => (
                <option key={days} value={days}>
                  {days} day{days === 1 ? "" : "s"}
                </option>
              ))}
              <option value="custom">Pick a date</option>
            </select>
          </label>
        ) : null}
        {status === "SNOOZED" && snoozedUntil ? (
          <span className="text-muted-foreground text-xs">Until {formatDate(snoozedUntil.slice(0, 10))}</span>
        ) : null}
      </div>

      {customOpen && canSnooze ? (
        <form
          className="flex flex-wrap items-center gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            if (customDate) {
              void patch({ op: "snooze", until: customDate });
            }
          }}
        >
          <label className="text-muted-foreground flex items-center gap-1.5 text-sm">
            Until
            <input
              type="date"
              className="border-input bg-background h-7 rounded-lg border px-2 text-xs"
              min={minDate}
              max={maxDate}
              value={customDate}
              disabled={busy}
              required
              onChange={(event) => setCustomDate(event.target.value)}
            />
          </label>
          <Button type="submit" size="sm" variant="outline" disabled={busy || !customDate}>
            Snooze
          </Button>
        </form>
      ) : null}

      {status !== "COMPLETED" ? (
        <form
          className="flex flex-wrap items-center gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            const next = waitingDraft.trim();
            if (next) {
              void patch({ op: "wait", waitingFor: next });
            }
          }}
        >
          <label className="text-muted-foreground flex min-w-0 flex-1 items-center gap-1.5 text-sm sm:max-w-xs">
            Waiting on
            <input
              type="text"
              className="border-input bg-background h-7 min-w-0 flex-1 rounded-lg border px-2 text-xs"
              maxLength={200}
              value={waitingDraft}
              disabled={busy}
              placeholder="who or what"
              aria-label="Waiting on"
              onChange={(event) => setWaitingDraft(event.target.value)}
            />
          </label>
          <Button type="submit" size="sm" variant="outline" disabled={busy || !waitingDraft.trim()}>
            {status === "WAITING" ? "Save" : "Waiting"}
          </Button>
        </form>
      ) : null}

      {error ? (
        <p className="text-destructive w-full text-xs" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
