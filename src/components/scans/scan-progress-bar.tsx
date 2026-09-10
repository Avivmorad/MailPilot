"use client";

import { scanProgressView } from "@/lib/scans/progress";

export function ScanProgressBar({
  threadsChecked,
  threadsDiscovered,
}: {
  threadsChecked: number;
  threadsDiscovered: number;
}) {
  const view = scanProgressView({ threadsChecked, threadsDiscovered });

  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <p>{view.label}</p>
        {view.indeterminate ? null : (
          <span className="text-muted-foreground shrink-0 tabular-nums">{view.percent}%</span>
        )}
      </div>
      <div
        className="bg-muted h-2 overflow-hidden rounded-full"
        role="progressbar"
        aria-label="Scan progress"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={view.indeterminate ? undefined : view.percent}
        aria-valuetext={view.label}
      >
        {view.indeterminate ? (
          <div className="bg-primary h-full w-1/3 animate-pulse rounded-full" />
        ) : (
          <div
            className="bg-primary h-full rounded-full transition-[width] duration-300"
            style={{ width: `${view.percent}%` }}
          />
        )}
      </div>
    </div>
  );
}
