-- One RUNNING scan_run per Gmail connection so manual and scheduled admission cannot race.

with ranked as (
  select
    id,
    row_number() over (
      partition by gmail_connection_id
      order by started_at desc nulls last, created_at desc
    ) as rn
  from public.scan_runs
  where status = 'RUNNING'
)
update public.scan_runs as scan
set
  status = 'FAILED',
  finished_at = coalesce(scan.finished_at, now()),
  error_code = coalesce(scan.error_code, 'stale_lease'),
  error_message = coalesce(
    scan.error_message,
    'Duplicate running scan removed before unique admission index'
  )
from ranked
where scan.id = ranked.id
  and ranked.rn > 1;

create unique index if not exists scan_runs_one_running_per_connection
  on public.scan_runs (gmail_connection_id)
  where status = 'RUNNING';

notify pgrst, 'reload schema';
