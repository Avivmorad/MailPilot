"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { ScanProgressBar } from "@/components/scans/scan-progress-bar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DEFAULT_LOOKBACK_DAYS,
  INITIAL_LOOKBACK_DAYS,
  LOOKBACK_OPTION_LABELS,
  type InitialLookbackDays,
} from "@/lib/scans/lookback";
import {
  latestScanResponseSchema,
  snapshotProgress,
  startScanResponseSchema,
  type ScanRunSnapshot,
} from "@/lib/scans/progress";

async function fetchLatestScan(): Promise<ScanRunSnapshot | null> {
  const response = await fetch("/api/scans", { cache: "no-store" });
  const payload: unknown = await response.json();
  const parsed = latestScanResponseSchema.safeParse(payload);
  return parsed.success ? parsed.data.scan : null;
}

export function InitialScanCard({
  connected,
  incremental,
  latestScan,
}: {
  connected: boolean;
  incremental: boolean;
  latestScan?: ScanRunSnapshot | null;
}) {
  const router = useRouter();
  const resumeId = latestScan?.status === "RUNNING" ? latestScan.id : null;
  const [lookbackDays, setLookbackDays] = useState<InitialLookbackDays>(DEFAULT_LOOKBACK_DAYS);
  const [watchId, setWatchId] = useState<string | null>(resumeId);
  const [busy, setBusy] = useState(Boolean(resumeId));
  const [progress, setProgress] = useState<ScanRunSnapshot | null>(
    resumeId && latestScan ? latestScan : null,
  );
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!busy || !watchId) {
      return;
    }
    let cancelled = false;

    async function tick() {
      const scan = await fetchLatestScan();
      if (cancelled || !scan) {
        return;
      }
      if (scan.status === "RUNNING") {
        if (scan.id === watchId) {
          setProgress(scan);
        }
        return;
      }
      if (scan.id !== watchId) {
        return;
      }
      setBusy(false);
      setProgress(null);
      setWatchId(null);
      if (scan.status === "FAILED") {
        setError(true);
        setMessage(scan.error_message ?? scan.error_code ?? "Scan failed.");
        return;
      }
      router.push("/dashboard?scan=done");
      router.refresh();
    }

    void tick();
    const timer = setInterval(() => {
      void tick();
    }, 800);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [busy, watchId, router]);

  async function runScan() {
    setBusy(true);
    setMessage(null);
    setError(false);
    setProgress({ id: "pending", status: "RUNNING", threads_discovered: 0, threads_checked: 0 });
    try {
      const response = await fetch("/api/scans", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ lookbackDays }),
      });
      const payload: unknown = await response.json();
      if (!response.ok) {
        const failed = payload as { error?: string; message?: string };
        setError(true);
        setMessage(failed.message ?? failed.error ?? "Scan failed.");
        setBusy(false);
        setProgress(null);
        return;
      }
      const started = startScanResponseSchema.safeParse(payload);
      if (!started.success) {
        setError(true);
        setMessage("Scan failed.");
        setBusy(false);
        setProgress(null);
        return;
      }
      setWatchId(started.data.scanId);
      setProgress({
        id: started.data.scanId,
        status: "RUNNING",
        threads_discovered: 0,
        threads_checked: 0,
      });
    } catch {
      setError(true);
      setMessage("Scan failed. Please try again.");
      setBusy(false);
      setProgress(null);
    }
  }

  const bar = progress ? snapshotProgress(progress) : { threadsDiscovered: 0, threadsChecked: 0 };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{incremental ? "Scan inbox" : "Initial scan"}</CardTitle>
        <CardDescription>
          Choose how far back to read. Unchanged threads are skipped. If Gmail hits its per-minute
          limit, the scan pauses for about a minute, then continues.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <label className="block text-sm">
          <span className="text-muted-foreground mb-1.5 block">Lookback window</span>
          <select
            className="border-input bg-background h-9 w-full max-w-xs rounded-lg border px-3 text-sm"
            value={lookbackDays}
            disabled={!connected || busy}
            onChange={(event) => setLookbackDays(Number(event.target.value) as InitialLookbackDays)}
          >
            {INITIAL_LOOKBACK_DAYS.map((value) => (
              <option key={value} value={value}>
                {LOOKBACK_OPTION_LABELS[value]}
              </option>
            ))}
          </select>
        </label>
        {busy ? (
          <ScanProgressBar threadsChecked={bar.threadsChecked} threadsDiscovered={bar.threadsDiscovered} />
        ) : null}
        <Button type="button" disabled={!connected || busy} onClick={() => void runScan()}>
          {busy ? "Scanning…" : incremental ? "Scan new mail" : "Scan now"}
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
