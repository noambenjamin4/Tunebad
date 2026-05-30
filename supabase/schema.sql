create table if not exists public.analysis_results (
  id uuid primary key default gen_random_uuid(),
  file_name text not null,
  duration_seconds numeric,
  bpm numeric,
  musical_key text,
  scale text,
  confidence integer,
  sample_rate integer,
  channels integer,
  created_at timestamptz not null default now()
);

create index if not exists analysis_results_created_at_idx
  on public.analysis_results (created_at desc);

alter table public.analysis_results enable row level security;
