"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function ScanPreferencesForm({
  dailyScanTime,
  timezone,
}: {
  dailyScanTime: string;
  timezone: string;
}) {
  const router = useRouter();
  const [time, setTime] = useState(dailyScanTime);
  const [zone, setZone] = useState(timezone);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState(false);

  async function save() {
    setBusy(true);
    setMessage(null);
    setError(false);
    try {
      const response = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ dailyScanTime: time, timezone: zone }),
      });
      if (!response.ok) {
        setError(true);
        setMessage("Could not save scan schedule.");
        return;
      }
      setMessage("Daily scan time saved. The next scheduled run was updated.");
      router.refresh();
    } catch {
      setError(true);
      setMessage("Could not save scan schedule.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Daily scan</CardTitle>
        <CardDescription>
          GmailPilot runs an incremental scan once a day at this local time. Manual Scan now is
          unchanged.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <label className="block text-sm">
          <span className="text-muted-foreground mb-1.5 block">Time</span>
          <input
            type="time"
            className="border-input bg-background h-9 w-full max-w-xs rounded-lg border px-3 text-sm"
            value={time}
            onChange={(event) => setTime(event.target.value)}
            disabled={busy}
          />
        </label>
        <label className="block text-sm">
          <span className="text-muted-foreground mb-1.5 block">Timezone</span>
          <input
            type="text"
            className="border-input bg-background h-9 w-full max-w-xs rounded-lg border px-3 text-sm"
            value={zone}
            onChange={(event) => setZone(event.target.value)}
            disabled={busy}
            autoComplete="off"
          />
        </label>
        <Button type="button" disabled={busy} onClick={() => void save()}>
          {busy ? "Saving…" : "Save schedule"}
        </Button>
        {message ? (
          <p className={error ? "text-destructive text-sm" : "text-sm"}>{message}</p>
        ) : null}
      </CardContent>
    </Card>
  );
}
