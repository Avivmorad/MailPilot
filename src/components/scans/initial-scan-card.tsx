"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DEFAULT_LOOKBACK_DAYS, type InitialLookbackDays } from "@/lib/scans/lookback";

const LOOKBACK_OPTIONS: Array<{ value: InitialLookbackDays; label: string }> = [
  { value: 1, label: "Last 24 hours" },
  { value: 3, label: "Last 3 days" },
  { value: 7, label: "Last 7 days" },
];

export function InitialScanCard({ connected }: { connected: boolean }) {
  const router = useRouter();
  const [lookbackDays, setLookbackDays] = useState<InitialLookbackDays>(DEFAULT_LOOKBACK_DAYS);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState(false);

  async function runScan() {
    setBusy(true);
    setMessage(null);
    setError(false);
    try {
      const response = await fetch("/api/scans", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ lookbackDays }),
      });
      const payload = (await response.json()) as {
        status?: string;
        counters?: { threadsAnalyzed?: number; messagesProcessed?: number };
        error?: string;
        message?: string;
      };
      if (!response.ok) {
        setError(true);
        setMessage(payload.message ?? payload.error ?? "Scan failed.");
        return;
      }
      router.push("/dashboard?scan=done");
      router.refresh();
    } catch {
      setError(true);
      setMessage("Scan failed. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Initial scan</CardTitle>
        <CardDescription>
          MailPilot reads the chosen window, classifies each thread, and applies MailPilot labels.
          Email bodies are not stored.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <label className="block text-sm">
          <span className="text-muted-foreground mb-1 block">Lookback</span>
          <select
            className="border-input bg-background h-8 rounded-lg border px-2 text-sm"
            value={lookbackDays}
            disabled={!connected || busy}
            onChange={(event) => setLookbackDays(Number(event.target.value) as InitialLookbackDays)}
          >
            {LOOKBACK_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <Button type="button" disabled={!connected || busy} onClick={() => void runScan()}>
          {busy ? "Scanning…" : "Scan now"}
        </Button>
        {message ? (
          <p className={error ? "text-destructive text-sm" : "text-sm"}>{message}</p>
        ) : null}
        {!connected ? (
          <p className="text-muted-foreground text-sm">Connect Gmail before running a scan.</p>
        ) : null}
      </CardContent>
    </Card>
  );
}
