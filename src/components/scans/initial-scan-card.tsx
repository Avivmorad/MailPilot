"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

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
import { DISPATCH_LEASE_SECONDS } from "@/lib/scans/dispatch-budget";
import { scanUserMessage } from "@/lib/scans/errors";
import { formatDateTime } from "@/lib/ui/format";
import { labelForScanStatus } from "@/lib/ui/labels";

const POLL_NULL_LIMIT = 3;
/** Resume a stalled RUNNING scan after the serverless lease window plus a buffer. */
const STALE_RESUME_MS = (DISPATCH_LEASE_SECONDS + 60) * 1000;

async function fetchLatestScan(): Promise<
  { ok: true; scan: ScanRunSnapshot | null } | { ok: false; status: number }
> {
  try {
    const response = await fetch("/api/scans", { cache: "no-store" });
    if (!response.ok) {
      return { ok: false, status: response.status };
    }
    const payload: unknown = await response.json();
    const parsed = latestScanResponseSchema.safeParse(payload);
    return { ok: true, scan: parsed.success ? parsed.data.scan : null };
  } catch {
    return { ok: false, status: 0 };
  }
}

function isStaleRunning(scan: ScanRunSnapshot, nowMs: number): boolean {
  if (scan.status !== "RUNNING") {
    return false;
  }
  const stamp = scan.updated_at ?? null;
  if (!stamp) {
    return false;
  }
  const parsed = Date.parse(stamp);
  if (!Number.isFinite(parsed)) {
    return false;
  }
  return nowMs - parsed >= STALE_RESUME_MS;
}

export function InitialScanCard({
  connected,
  incremental,
  latestScan,
  lastRunAt,
  nextScanAt,
  lastRunStatus,
  messagesProcessed,
  completeHref = "/dashboard?scan=done",
}: {
  connected: boolean;
  incremental: boolean;
  latestScan?: ScanRunSnapshot | null;
  lastRunAt?: string | null;
  nextScanAt?: string | null;
  lastRunStatus?: string | null;
  messagesProcessed?: number | null;
  completeHref?: string;
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
  const nullPolls = useRef(0);
  const resumeInFlight = useRef(false);
  const progressRef = useRef(progress);

  useEffect(() => {
    progressRef.current = progress;
  }, [progress]);

  useEffect(() => {
    if (!busy || !watchId) {
      return;
    }
    let cancelled = false;

    async function resumeStalled(scanId: string) {
      if (resumeInFlight.current) {
        return;
      }
      resumeInFlight.current = true;
      try {
        const response = await fetch("/api/scans", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ lookbackDays }),
        });
        const payload: unknown = await response.json().catch(() => ({}));
        if (!response.ok) {
          const failed = payload as { error?: string; message?: string };
          if (failed.error === "scan_in_progress") {
            return;
          }
          setError(true);
          setErrorCode(failed.error ?? "scan_failed");
          setMessage(scanUserMessage(failed.error, failed.message));
          setBusy(false);
          setProgress(null);
          setWatchId(null);
          return;
        }
        const started = startScanResponseSchema.safeParse(payload);
        const prev = progressRef.current;
        if (started.success) {
          setWatchId(started.data.scanId);
          setProgress({
            id: started.data.scanId,
            status: "RUNNING",
            threads_discovered: prev?.threads_discovered ?? 0,
            threads_checked: prev?.threads_checked ?? 0,
            updated_at: new Date().toISOString(),
          });
        } else if (scanId) {
          setProgress((current) =>
            current ? { ...current, updated_at: new Date().toISOString() } : current,
          );
        }
      } catch {
        setError(true);
        setMessage("Scan stalled. Please try again.");
        setBusy(false);
        setProgress(null);
        setWatchId(null);
      } finally {
        resumeInFlight.current = false;
      }
    }

    async function tick() {
      const result = await fetchLatestScan();
      if (cancelled) {
        return;
      }
      if (!result.ok) {
        nullPolls.current += 1;
        if (nullPolls.current >= POLL_NULL_LIMIT) {
          setError(true);
          setErrorCode(result.status === 401 ? "not_signed_in" : "scan_failed");
          setMessage(
            result.status === 401
              ? "Sign in again to follow scan progress."
              : "Could not load scan progress. Please try again.",
          );
          setBusy(false);
          setProgress(null);
          setWatchId(null);
        }
        return;
      }
      nullPolls.current = 0;
      const scan = result.scan;
      if (!scan) {
        nullPolls.current += 1;
        if (nullPolls.current >= POLL_NULL_LIMIT) {
          setError(true);
          setMessage("Could not load scan progress. Please try again.");
          setBusy(false);
          setProgress(null);
          setWatchId(null);
        }
        return;
      }
      if (scan.status === "RUNNING") {
        if (scan.id === watchId || watchId === "pending") {
          setWatchId(scan.id);
          setProgress(scan);
          if (isStaleRunning(scan, Date.now())) {
            void resumeStalled(scan.id);
          }
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
        const cancelledScan = scan.error_code === "cancelled";
        setError(!cancelledScan);
        setErrorCode(scan.error_code ?? "scan_failed");
        setMessage(scanUserMessage(scan.error_code, scan.error_message));
        return;
      }
      router.push(completeHref);
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
  }, [busy, watchId, router, completeHref, lookbackDays]);

  async function cancelScan() {
    if (!watchId || watchId === "pending") {
      return;
    }
    try {
      const response = await fetch(`/api/scans/${watchId}/cancel`, { method: "POST" });
      const payload: unknown = await response.json().catch(() => ({}));
      if (!response.ok) {
        const failed = payload as { error?: string; message?: string };
        setError(true);
        setErrorCode(failed.error ?? "scan_failed");
        setMessage(scanUserMessage(failed.error, failed.message));
        return;
      }
      setBusy(false);
      setProgress(null);
      setWatchId(null);
      setError(false);
      setErrorCode("cancelled");
      setMessage(scanUserMessage("cancelled"));
    } catch {
      setError(true);
      setMessage("Could not cancel the scan.");
    }
  }

  async function runScan() {
    setBusy(true);
    setMessage(null);
    setError(false);
    setErrorCode(null);
    nullPolls.current = 0;
    setProgress({
      id: "pending",
      status: "RUNNING",
      threads_discovered: 0,
      threads_checked: 0,
      updated_at: new Date().toISOString(),
    });
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
        updated_at: new Date().toISOString(),
      });
    } catch {
      setError(true);
      setMessage("Scan failed. Please try again.");
      setBusy(false);
      setProgress(null);
    }
  }

  const bar = progress
    ? snapshotProgress(progress)
    : { threadsDiscovered: 0, threadsChecked: 0, status: null, errorCode: null };
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
          <ScanProgressBar
            threadsChecked={bar.threadsChecked}
            threadsDiscovered={bar.threadsDiscovered}
            status={bar.status}
            errorCode={bar.errorCode}
          />
        ) : null}
        <div className="flex flex-wrap items-end gap-3">
          <label className="block min-w-40 flex-1 text-sm">
            <span className="text-muted-foreground mb-1.5 block">Lookback window</span>
            <select
              className="border-input bg-background h-9 w-full max-w-xs rounded-lg border px-3 text-sm"
              value={lookbackDays}
              disabled={!connected || busy}
              onChange={(event) =>
                setLookbackDays(Number(event.target.value) as InitialLookbackDays)
              }
            >
              {INITIAL_LOOKBACK_DAYS.map((value) => (
                <option key={value} value={value}>
                  {LOOKBACK_OPTION_LABELS[value]}
                </option>
              ))}
            </select>
          </label>
          <Button
            type="button"
            size="lg"
            disabled={!connected || busy}
            aria-busy={busy}
            onClick={() => void runScan()}
          >
            {busy ? "Scanning…" : incremental ? "Scan new mail" : "Scan now"}
          </Button>
          {busy ? (
            <Button
              type="button"
              size="lg"
              variant="outline"
              disabled={!watchId || watchId === "pending"}
              onClick={() => void cancelScan()}
            >
              Cancel scan
            </Button>
          ) : null}
        </div>
        {message ? (
          <p
            className={error ? "text-destructive text-sm" : "text-sm"}
            role={error ? "alert" : "status"}
          >
            {message}
            {error && errorCode === "reauth_required" ? (
              <>
                {" "}
                <a className="underline" href="/api/gmail/connect?returnTo=/dashboard">
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
              {lastRunStatus === "PARTIAL" ? " · Retries queued" : ""}
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
