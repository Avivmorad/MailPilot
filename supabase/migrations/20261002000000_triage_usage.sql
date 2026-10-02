-- Token / cost telemetry: one append-only row per triage HTTP attempt.
-- Service-role inserts from scan code; owners may select their own rows.
-- See docs/ARCHITECTURE.md (triage_usage) and docs/PRODUCT.md (Usage screen).

create table if not exists public.triage_usage (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  gmail_connection_id uuid not null references public.gmail_connections (id) on delete cascade,
  scan_id uuid not null references public.scan_runs (id) on delete cascade,
  provider text not null check (provider in ('nvidia', 'gemini')),
  model text not null,
  prompt_version text not null,
  attempt integer not null check (attempt >= 0 and attempt <= 1),
  outcome text not null check (
    outcome in ('ok', 'schema', 'provider_error', 'timeout', 'aborted')
  ),
  usage_source text not null check (usage_source in ('provider', 'absent')),
  input_tokens integer check (input_tokens is null or input_tokens >= 0),
  output_tokens integer check (output_tokens is null or output_tokens >= 0),
  reasoning_tokens integer check (reasoning_tokens is null or reasoning_tokens >= 0),
  total_tokens integer check (total_tokens is null or total_tokens >= 0),
  priced_micro_usd bigint check (priced_micro_usd is null or priced_micro_usd >= 0),
  price_table_version text not null,
  billable boolean not null,
  duration_ms integer not null check (duration_ms >= 0),
  created_at timestamptz not null default now()
);

create index if not exists triage_usage_user_created_idx
  on public.triage_usage (user_id, created_at desc);

create index if not exists triage_usage_scan_idx
  on public.triage_usage (scan_id);

create index if not exists triage_usage_provider_model_created_idx
  on public.triage_usage (provider, model, created_at desc);

alter table public.triage_usage enable row level security;

drop policy if exists "triage_usage_select_own" on public.triage_usage;
create policy "triage_usage_select_own"
  on public.triage_usage for select
  using (auth.uid() = user_id);

grant all on table public.triage_usage to service_role;
grant select on table public.triage_usage to authenticated;

notify pgrst, 'reload schema';
