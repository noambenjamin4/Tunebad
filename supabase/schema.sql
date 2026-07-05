-- TuneBad: analysis history persistence (OPTIONAL Supabase backend)
--
-- Setup:
--   1. Create a Supabase project at https://supabase.com/dashboard.
--   2. Open the SQL editor for your project and run this entire file once.
--   3. Go to Authentication -> Providers and enable "Anonymous sign-ins".
--      (TuneBad signs users in anonymously so each browser gets its own
--      private history; no email/password/OAuth is required.)
--   4. Copy your Project URL and anon public key into NEXT_PUBLIC_SUPABASE_URL
--      and NEXT_PUBLIC_SUPABASE_ANON_KEY (locally in .env.local, or in your
--      Vercel project's Environment Variables).
--
-- If these env vars are left unset, TuneBad falls back to localStorage-only
-- history and none of this is required.

create table if not exists public.analysis_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  name text not null,
  bpm real,
  key text,
  camelot text,
  duration real,
  created_at timestamptz not null default now(),
  unique (user_id, name)
);

create index if not exists analysis_history_user_created_idx
  on public.analysis_history (user_id, created_at desc);

alter table public.analysis_history enable row level security;

drop policy if exists "analysis_history_select_own" on public.analysis_history;
create policy "analysis_history_select_own"
  on public.analysis_history
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "analysis_history_insert_own" on public.analysis_history;
create policy "analysis_history_insert_own"
  on public.analysis_history
  for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "analysis_history_delete_own" on public.analysis_history;
create policy "analysis_history_delete_own"
  on public.analysis_history
  for delete
  to authenticated
  using (auth.uid() = user_id);

-- Keep only the 50 most recent rows per user; trims older rows after each insert.
create or replace function public.cap_history_rows()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.analysis_history
  where user_id = new.user_id
    and id not in (
      select id
      from public.analysis_history
      where user_id = new.user_id
      order by created_at desc
      limit 50
    );
  return new;
end;
$$;

drop trigger if exists cap_history_rows on public.analysis_history;
create trigger cap_history_rows
  after insert on public.analysis_history
  for each row
  execute function public.cap_history_rows();

-- Migration if the table already exists:
--
-- -- Dedupe first: the unique constraint below fails if duplicate
-- -- (user_id, name) rows already exist.
-- delete from public.analysis_history a
--   using public.analysis_history b
--   where a.user_id = b.user_id
--     and a.name = b.name
--     and a.created_at < b.created_at;
--
-- do $$
-- begin
--   if not exists (
--     select 1 from pg_constraint where conname = 'analysis_history_user_id_name_key'
--   ) then
--     alter table public.analysis_history
--       add constraint analysis_history_user_id_name_key unique (user_id, name);
--   end if;
-- end $$;
--
-- create index if not exists analysis_history_user_created_idx
--   on public.analysis_history (user_id, created_at desc);
