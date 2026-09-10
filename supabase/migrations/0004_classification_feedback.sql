-- Phase 6: thread classification feedback for future evals (spec §29).

create table if not exists public.classification_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  thread_id uuid not null references public.email_threads (id) on delete cascade,
  kind text not null,
  created_at timestamptz not null default now()
);

create index if not exists classification_feedback_thread_idx
  on public.classification_feedback (thread_id, created_at desc);

alter table public.classification_feedback enable row level security;

drop policy if exists "classification_feedback_select_own" on public.classification_feedback;
create policy "classification_feedback_select_own"
  on public.classification_feedback for select
  using (auth.uid() = user_id);

drop policy if exists "classification_feedback_insert_own" on public.classification_feedback;
create policy "classification_feedback_insert_own"
  on public.classification_feedback for insert
  with check (auth.uid() = user_id);

grant all on table public.classification_feedback to service_role;
grant select, insert on table public.classification_feedback to authenticated;

notify pgrst, 'reload schema';
