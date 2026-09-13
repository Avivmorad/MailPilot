-- Persist Gmail thread ids and a resume cursor so large scans continue
-- across Vercel Hobby 300s invocations. Ids only — never email bodies.

alter table public.scan_runs
  add column if not exists lookback_days integer,
  add column if not exists discovery_mode text,
  add column if not exists discovery_complete boolean not null default false,
  add column if not exists discovered_thread_ids jsonb not null default '[]'::jsonb,
  add column if not exists thread_cursor integer not null default 0,
  add column if not exists history_boundary text,
  add column if not exists failed_thread_ids jsonb not null default '[]'::jsonb,
  add column if not exists updated_at timestamptz not null default now();

drop trigger if exists scan_runs_set_updated_at on public.scan_runs;
create trigger scan_runs_set_updated_at
  before update on public.scan_runs
  for each row
  execute function public.set_updated_at();

alter table public.scan_runs
  drop constraint if exists scan_runs_thread_cursor_nonnegative;
alter table public.scan_runs
  add constraint scan_runs_thread_cursor_nonnegative
  check (thread_cursor >= 0);

alter table public.scan_runs
  drop constraint if exists scan_runs_lookback_days_check;
alter table public.scan_runs
  add constraint scan_runs_lookback_days_check
  check (lookback_days is null or lookback_days in (1, 2, 3, 4, 7, 14, 21, 30));

alter table public.scan_runs
  drop constraint if exists scan_runs_discovery_mode_check;
alter table public.scan_runs
  add constraint scan_runs_discovery_mode_check
  check (
    discovery_mode is null
    or discovery_mode in ('INITIAL', 'INCREMENTAL', 'RECOVERY')
  );

notify pgrst, 'reload schema';
