-- Phase 5: initial scan tables (settings, threads, messages, actions, scan_runs).
-- See docs/PROJECT_SPEC.md §16.4–16.8 and docs/PRODUCT_DECISIONS.md.

create table if not exists public.user_triage_settings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade unique,
  initial_lookback_days integer not null default 7,
  scan_interval_minutes integer,
  daily_scan_time time,
  timezone text not null default 'Asia/Jerusalem',
  include_archived boolean not null default true,
  include_sent boolean not null default true,
  vip_senders jsonb not null default '[]'::jsonb,
  ignored_senders jsonb not null default '[]'::jsonb,
  ignored_domains jsonb not null default '[]'::jsonb,
  custom_ai_instructions text,
  digest_enabled boolean not null default true,
  digest_delivery text not null default 'in_app',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.user_triage_settings enable row level security;

drop policy if exists "user_triage_settings_select_own" on public.user_triage_settings;
create policy "user_triage_settings_select_own"
  on public.user_triage_settings for select
  using (auth.uid() = user_id);

drop policy if exists "user_triage_settings_insert_own" on public.user_triage_settings;
create policy "user_triage_settings_insert_own"
  on public.user_triage_settings for insert
  with check (auth.uid() = user_id);

drop policy if exists "user_triage_settings_update_own" on public.user_triage_settings;
create policy "user_triage_settings_update_own"
  on public.user_triage_settings for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop trigger if exists user_triage_settings_set_updated_at on public.user_triage_settings;
create trigger user_triage_settings_set_updated_at
  before update on public.user_triage_settings
  for each row
  execute function public.set_updated_at();

create table if not exists public.email_threads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  gmail_connection_id uuid not null references public.gmail_connections (id) on delete cascade,
  gmail_thread_id text not null,
  subject text,
  participants jsonb not null default '[]'::jsonb,
  latest_message_at timestamptz,
  latest_message_direction text,
  summary text,
  short_display_title text,
  importance text,
  importance_reason text,
  status text,
  requires_action boolean not null default false,
  requires_reply boolean not null default false,
  action_type text,
  action_summary text,
  action_reason text,
  waiting_for text,
  waiting_since timestamptz,
  urgency text,
  deadline date,
  deadline_text text,
  category text,
  confidence numeric,
  analysis_version text,
  prompt_version text,
  model_name text,
  last_analyzed_message_id text,
  last_analyzed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (gmail_connection_id, gmail_thread_id)
);

create index if not exists email_threads_user_status_idx
  on public.email_threads (user_id, status);
create index if not exists email_threads_user_deadline_idx
  on public.email_threads (user_id, deadline);

alter table public.email_threads enable row level security;

drop policy if exists "email_threads_select_own" on public.email_threads;
create policy "email_threads_select_own"
  on public.email_threads for select
  using (auth.uid() = user_id);

drop trigger if exists email_threads_set_updated_at on public.email_threads;
create trigger email_threads_set_updated_at
  before update on public.email_threads
  for each row
  execute function public.set_updated_at();

create table if not exists public.email_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  gmail_connection_id uuid not null references public.gmail_connections (id) on delete cascade,
  thread_id uuid not null references public.email_threads (id) on delete cascade,
  gmail_message_id text not null,
  gmail_thread_id text not null,
  gmail_history_id text,
  internet_message_id text,
  sender_email text,
  sender_name text,
  to_addresses jsonb not null default '[]'::jsonb,
  cc_addresses jsonb not null default '[]'::jsonb,
  subject text,
  snippet text,
  direction text not null,
  received_at timestamptz not null,
  gmail_label_ids jsonb not null default '[]'::jsonb,
  has_attachments boolean not null default false,
  attachments jsonb not null default '[]'::jsonb,
  content_hash text,
  processed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (gmail_connection_id, gmail_message_id)
);

create index if not exists email_messages_thread_id_idx
  on public.email_messages (thread_id);

alter table public.email_messages enable row level security;

drop policy if exists "email_messages_select_own" on public.email_messages;
create policy "email_messages_select_own"
  on public.email_messages for select
  using (auth.uid() = user_id);

create table if not exists public.action_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  thread_id uuid not null references public.email_threads (id) on delete cascade unique,
  status text not null,
  title text not null,
  description text,
  action_type text,
  waiting_for text,
  deadline date,
  urgency text,
  source text not null default 'AI',
  manual_override boolean not null default false,
  completed_at timestamptz,
  snoozed_until timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists action_items_user_status_idx
  on public.action_items (user_id, status);

alter table public.action_items enable row level security;

drop policy if exists "action_items_select_own" on public.action_items;
create policy "action_items_select_own"
  on public.action_items for select
  using (auth.uid() = user_id);

drop trigger if exists action_items_set_updated_at on public.action_items;
create trigger action_items_set_updated_at
  before update on public.action_items
  for each row
  execute function public.set_updated_at();

create table if not exists public.scan_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  gmail_connection_id uuid not null references public.gmail_connections (id) on delete cascade,
  trigger_type text not null,
  status text not null,
  window_start timestamptz,
  window_end timestamptz,
  started_at timestamptz,
  finished_at timestamptz,
  messages_discovered integer not null default 0,
  messages_processed integer not null default 0,
  threads_analyzed integer not null default 0,
  important_count integer not null default 0,
  action_count integer not null default 0,
  reply_count integer not null default 0,
  waiting_count integer not null default 0,
  informational_count integer not null default 0,
  ignored_count integer not null default 0,
  error_code text,
  error_message text,
  created_at timestamptz not null default now()
);

create index if not exists scan_runs_connection_status_idx
  on public.scan_runs (gmail_connection_id, status);

alter table public.scan_runs enable row level security;

drop policy if exists "scan_runs_select_own" on public.scan_runs;
create policy "scan_runs_select_own"
  on public.scan_runs for select
  using (auth.uid() = user_id);

grant all on table public.user_triage_settings to service_role;
grant all on table public.email_threads to service_role;
grant all on table public.email_messages to service_role;
grant all on table public.action_items to service_role;
grant all on table public.scan_runs to service_role;

grant select on table public.user_triage_settings to authenticated;
grant select on table public.email_threads to authenticated;
grant select on table public.email_messages to authenticated;
grant select on table public.action_items to authenticated;
grant select on table public.scan_runs to authenticated;

notify pgrst, 'reload schema';
