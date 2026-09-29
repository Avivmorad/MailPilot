-- Apply before deploying the scan-accounting changes. Existing analysis has
-- unknown attribution and is deliberately not backfilled or re-counted.
alter table public.email_threads
  add column if not exists analysis_scan_id uuid
    references public.scan_runs (id) on delete set null;

create index if not exists email_threads_analysis_scan_idx
  on public.email_threads (analysis_scan_id)
  where analysis_scan_id is not null;

comment on column public.email_threads.analysis_scan_id is
  'Scan which persisted this validated analysis; saved atomically with the analysis for checkpoint replay accounting. Not a provider request/billing counter.';
