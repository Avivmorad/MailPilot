-- Pin trigger function search_path and hide SECURITY DEFINER signup helper from the Data API.
-- See https://supabase.com/docs/guides/database/database-linter?lint=0011_function_search_path_mutable
-- and https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, primary_email, display_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'display_name', new.email)
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

revoke execute on function public.set_updated_at() from public, anon, authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;

notify pgrst, 'reload schema';
