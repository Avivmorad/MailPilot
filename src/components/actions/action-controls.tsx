"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { SNOOZE_DAYS, type SnoozeDays } from "@/lib/actions/patch-schema";

export function ActionControls({
  actionId,
  status,
}: {
  actionId: string;
  status: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      router.refresh();
    } catch {
      setError("Update failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {status !== "COMPLETED" ? (
          <Button type="button" size="sm" disabled={busy} aria-busy={busy} onClick={() => void patch({ op: "complete" })}>
          Done
        </Button>
      ) : (
        <Button type="button" size="sm" variant="outline" disabled={busy} aria-busy={busy} onClick={() => void patch({ op: "reopen" })}>
          Reopen
        </Button>
      )}
      {status !== "COMPLETED" ? (
        <label className="text-muted-foreground flex items-center gap-1.5 text-sm">
          Snooze
          <select
            className="border-input bg-background h-7 rounded-lg border px-2 text-xs"
            disabled={busy}
            defaultValue=""
            aria-label="Snooze for"
            onChange={(event) => {
              const days = Number(event.target.value) as SnoozeDays;
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
          </select>
        </label>
      ) : null}
      {error ? (
        <p className="text-destructive w-full text-xs" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
