-- Phase 8: connection leases, scan_jobs, and atomic claim for the global dispatcher.
-- See docs/PROJECT_SPEC.md §8–9 / §16.9 and docs/PRODUCT_DECISIONS.md.

alter table public.gmail_connections
  add column if not exists locked_at timestamptz,
  add column if not exists locked_by text,
  add column if not exists lease_expires_at timestamptz;

create index if not exists gmail_connections_due_scan_idx
  on public.gmail_connections (status, next_scan_at)
  where status = 'CONNECTED';

create table if not exists public.scan_jobs (
  id uuid primary key default gen_random_uuid(),
  scan_run_id uuid references public.scan_runs (id) on delete set null,
  gmail_connection_id uuid not null references public.gmail_connections (id) on delete cascade,
  status text not null,
  -- QUEUED | RUNNING | SUCCESS | FAILED
  attempt integer not null default 0,
  locked_at timestamptz,
  locked_by text,
  lease_expires_at timestamptz,
  available_at timestamptz not null default now(),
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists scan_jobs_connection_status_idx
  on public.scan_jobs (gmail_connection_id, status);

create unique index if not exists scan_jobs_one_active_per_connection
  on public.scan_jobs (gmail_connection_id)
  where status in ('QUEUED', 'RUNNING');

alter table public.scan_jobs enable row level security;

drop policy if exists "scan_jobs_select_own" on public.scan_jobs;
create policy "scan_jobs_select_own"
  on public.scan_jobs for select
  using (
    exists (
      select 1
      from public.gmail_connections c
      where c.id = scan_jobs.gmail_connection_id
        and c.user_id = auth.uid()
    )
  );

drop trigger if exists scan_jobs_set_updated_at on public.scan_jobs;
create trigger scan_jobs_set_updated_at
  before update on public.scan_jobs
  for each row
  execute function public.set_updated_at();

grant all on table public.scan_jobs to service_role;
grant select on table public.scan_jobs to authenticated;

create schema if not exists private;
revoke all on schema private from public;
revoke all on schema private from anon, authenticated;
grant usage on schema private to service_role;

create or replace function private.claim_due_gmail_connections(
  p_worker text,
  p_limit integer default 3,
  p_lease_seconds integer default 1200
)
returns table (
  id uuid,
  user_id uuid,
  gmail_email text
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_limit < 1 or p_limit > 25 then
    raise exception 'p_limit out of range';
  end if;
  if p_lease_seconds < 60 or p_lease_seconds > 7200 then
    raise exception 'p_lease_seconds out of range';
  end if;

  return query
  with due as (
    select c.id
    from public.gmail_connections c
    where c.status = 'CONNECTED'
      and c.next_scan_at is not null
      and c.next_scan_at <= now()
      and (c.lease_expires_at is null or c.lease_expires_at < now())
    order by c.next_scan_at
    limit p_limit
    for update skip locked
  )
  update public.gmail_connections c
  set
    locked_at = now(),
    locked_by = p_worker,
    lease_expires_at = now() + make_interval(secs => p_lease_seconds)
  from due
  where c.id = due.id
  returning c.id, c.user_id, c.gmail_email;
end;
$$;

revoke all on function private.claim_due_gmail_connections(text, integer, integer) from public;
revoke all on function private.claim_due_gmail_connections(text, integer, integer) from anon, authenticated;
grant execute on function private.claim_due_gmail_connections(text, integer, integer) to service_role;

notify pgrst, 'reload schema';
