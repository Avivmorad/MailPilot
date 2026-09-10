-- Phase 9: in-app digest reports. See docs/PROJECT_SPEC.md §16.10 / §63 Phase 9.
-- top_actions is a snapshot of unique open-task cards for the period (not in the spec table).

create table if not exists public.digest_reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  gmail_connection_id uuid not null references public.gmail_connections (id) on delete cascade,
  period_start timestamptz not null,
  period_end timestamptz not null,
  total_messages integer not null,
  important_count integer not null,
  action_count integer not null,
  reply_count integer not null,
  waiting_count integer not null,
  informational_count integer not null,
  ignored_count integer not null,
  summary_text text,
  top_actions jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  unique (gmail_connection_id, period_start, period_end)
);

create index if not exists digest_reports_user_created_idx
  on public.digest_reports (user_id, created_at desc);

alter table public.digest_reports enable row level security;

drop policy if exists "digest_reports_select_own" on public.digest_reports;
create policy "digest_reports_select_own"
  on public.digest_reports for select
  using (auth.uid() = user_id);

grant all on table public.digest_reports to service_role;
grant select on table public.digest_reports to authenticated;

notify pgrst, 'reload schema';
