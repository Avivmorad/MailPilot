-- Scan progress: unique conversations found vs finished during a RUNNING scan.
-- Used by the dashboard status bar. See docs/PRODUCT_DECISIONS.md.

alter table public.scan_runs
  add column if not exists threads_discovered integer not null default 0;

alter table public.scan_runs
  add column if not exists threads_checked integer not null default 0;

notify pgrst, 'reload schema';
