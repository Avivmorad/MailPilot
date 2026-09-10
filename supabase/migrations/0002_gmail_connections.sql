-- Phase 2: Gmail OAuth connections and managed MailPilot labels.
-- See docs/PROJECT_SPEC.md §16.2–16.3 and docs/PRODUCT_DECISIONS.md.

create table if not exists public.gmail_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  gmail_email text not null,
  google_account_id text,
  encrypted_refresh_token text,
  status text not null,
  -- CONNECTED | REAUTH_REQUIRED | DISCONNECTED | ERROR
  gmail_history_id text,
  last_successful_scan_at timestamptz,
  last_attempted_scan_at timestamptz,
  next_scan_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, gmail_email)
);

create index if not exists gmail_connections_user_id_idx
  on public.gmail_connections (user_id);

create index if not exists gmail_connections_next_scan_at_idx
  on public.gmail_connections (next_scan_at);

alter table public.gmail_connections enable row level security;

drop policy if exists "gmail_connections_select_own" on public.gmail_connections;
create policy "gmail_connections_select_own"
  on public.gmail_connections for select
  using (auth.uid() = user_id);

drop policy if exists "gmail_connections_insert_own" on public.gmail_connections;
create policy "gmail_connections_insert_own"
  on public.gmail_connections for insert
  with check (auth.uid() = user_id);

drop policy if exists "gmail_connections_update_own" on public.gmail_connections;
create policy "gmail_connections_update_own"
  on public.gmail_connections for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop trigger if exists gmail_connections_set_updated_at on public.gmail_connections;
create trigger gmail_connections_set_updated_at
  before update on public.gmail_connections
  for each row
  execute function public.set_updated_at();

-- Safe projection: never expose encrypted_refresh_token to PostgREST clients.
create or replace view public.gmail_connections_safe
with (security_invoker = true) as
select
  id,
  user_id,
  gmail_email,
  google_account_id,
  status,
  gmail_history_id,
  last_successful_scan_at,
  last_attempted_scan_at,
  next_scan_at,
  created_at,
  updated_at
from public.gmail_connections;

grant select on public.gmail_connections_safe to authenticated;

-- Defense in depth: the user JWT client must not read encrypted_refresh_token.
revoke all on public.gmail_connections from anon, authenticated;
grant select (
  id,
  user_id,
  gmail_email,
  google_account_id,
  status,
  gmail_history_id,
  last_successful_scan_at,
  last_attempted_scan_at,
  next_scan_at,
  created_at,
  updated_at
) on public.gmail_connections to authenticated;

create table if not exists public.gmail_labels (
  id uuid primary key default gen_random_uuid(),
  gmail_connection_id uuid not null references public.gmail_connections (id) on delete cascade,
  logical_name text not null,
  gmail_label_id text not null,
  gmail_label_name text not null,
  created_at timestamptz not null default now(),
  unique (gmail_connection_id, logical_name),
  unique (gmail_connection_id, gmail_label_id)
);

alter table public.gmail_labels enable row level security;

drop policy if exists "gmail_labels_select_own" on public.gmail_labels;
create policy "gmail_labels_select_own"
  on public.gmail_labels for select
  using (
    exists (
      select 1
      from public.gmail_connections c
      where c.id = gmail_labels.gmail_connection_id
        and c.user_id = auth.uid()
    )
  );

grant all on table public.gmail_connections to service_role;
grant all on table public.gmail_labels to service_role;

-- Reload PostgREST so the new tables are visible immediately.
notify pgrst, 'reload schema';
