"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { ScanProgressBar } from "@/components/scans/scan-progress-bar";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import { scanUserMessage } from "@/lib/scans/errors";
import { formatDateTime } from "@/lib/ui/format";
import { labelForScanStatus } from "@/lib/ui/labels";

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
  lastRunAt,
  nextScanAt,
  lastRunStatus,
  messagesProcessed,
}: {
  connected: boolean;
  incremental: boolean;
  latestScan?: ScanRunSnapshot | null;
  lastRunAt?: string | null;
  nextScanAt?: string | null;
  lastRunStatus?: string | null;
  messagesProcessed?: number | null;
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
  const [errorCode, setErrorCode] = useState<string | null>(null);

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
        setErrorCode(scan.error_code ?? "scan_failed");
        setMessage(scanUserMessage(scan.error_code, scan.error_message));
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
    setErrorCode(null);
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
        setErrorCode(failed.error ?? "scan_failed");
        setMessage(scanUserMessage(failed.error, failed.message));
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
  const statusLabel = lastRunStatus ? labelForScanStatus(lastRunStatus) : null;

  return (
    <Card id="scan">
      <CardHeader>
        <CardTitle>{incremental ? "Scan inbox" : "Initial scan"}</CardTitle>
        <CardDescription>
          {busy
            ? "Checking conversations in the background. You can keep using MailPilot."
            : "Choose how far back to read. Unchanged threads are skipped."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {busy ? (
          <ScanProgressBar threadsChecked={bar.threadsChecked} threadsDiscovered={bar.threadsDiscovered} />
        ) : null}
        <div className="flex flex-wrap items-end gap-3">
          <label className="block min-w-40 flex-1 text-sm">
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
          <Button type="button" size="lg" disabled={!connected || busy} onClick={() => void runScan()}>
            {busy ? "Scanning…" : incremental ? "Scan new mail" : "Scan now"}
          </Button>
        </div>
        {message ? (
          <p className={error ? "text-destructive text-sm" : "text-sm"}>
            {message}
            {error && errorCode === "reauth_required" ? (
              <>
                {" "}
                <a className="underline" href="/api/gmail/connect">
                  Reconnect Gmail
                </a>
              </>
            ) : null}
          </p>
        ) : null}
        {!connected ? (
          <p className="text-muted-foreground text-sm">Connect Gmail before running a scan.</p>
        ) : null}
      </CardContent>
      {lastRunAt || nextScanAt || busy ? (
        <CardFooter className="text-muted-foreground flex-wrap gap-x-4 gap-y-1 text-sm">
          {lastRunAt ? (
            <span>
              Last run {formatDateTime(lastRunAt)}
              {statusLabel ? ` · ${statusLabel}` : ""}
              {typeof messagesProcessed === "number" ? ` · ${messagesProcessed} emails` : ""}
            </span>
          ) : busy ? (
            <span>In progress</span>
          ) : (
            <span>No scan yet</span>
          )}
          {nextScanAt ? <span>Next scan {formatDateTime(nextScanAt)}</span> : null}
        </CardFooter>
      ) : null}
    </Card>
  );
}
