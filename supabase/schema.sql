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

-- ---------------------------------------------------------------------------
-- Shared "analyze from link" cache + programmatic /song/<slug> pages.
--
-- Public songs analyzed from official 30s previews are cached here (uploaded
-- files are never stored). Rows are world-readable and immutable (first write
-- wins); the anon key may insert but not update or delete. The SEO slug is
-- derived from title+artist by a trigger so every write path gets one.
-- ---------------------------------------------------------------------------
create table if not exists public.link_analysis (
  id text primary key,
  slug text unique,
  title text not null,
  artist text,
  bpm real not null check (bpm >= 40 and bpm <= 260),
  bpm_alt real check (bpm_alt >= 20 and bpm_alt <= 520),
  key text not null,
  camelot text,
  energy real check (energy >= 0 and energy <= 1),
  danceability real check (danceability >= 0 and danceability <= 1),
  loudness_db real check (loudness_db >= -100 and loudness_db <= 10),
  duration_s real check (duration_s > 0),
  source text not null default 'preview',
  created_at timestamptz not null default now()
);

create or replace function public.tunebad_slugify(txt text) returns text as $$
  select trim(both '-' from regexp_replace(lower(coalesce(txt, '')), '[^a-z0-9]+', '-', 'g'));
$$ language sql immutable;

create or replace function public.link_analysis_set_slug() returns trigger as $$
declare base text;
begin
  base := public.tunebad_slugify(new.title || '-' || coalesce(new.artist, ''));
  if base = '' then base := 'track'; end if;
  if exists (select 1 from public.link_analysis where slug = base and id <> new.id) then
    new.slug := base || '-' || substr(md5(new.id), 1, 6);
  else
    new.slug := base;
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_link_analysis_slug on public.link_analysis;
create trigger trg_link_analysis_slug
  before insert on public.link_analysis
  for each row execute function public.link_analysis_set_slug();

alter table public.link_analysis enable row level security;

drop policy if exists "link_analysis_public_read" on public.link_analysis;
create policy "link_analysis_public_read"
  on public.link_analysis for select to anon, authenticated using (true);

drop policy if exists "link_analysis_anon_insert" on public.link_analysis;
create policy "link_analysis_anon_insert"
  on public.link_analysis for insert to anon, authenticated with check (true);

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
