-- WOLVGUARD Supabase schema
-- Execute this in the Supabase SQL editor for the existing project.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '',
  organization_name text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists public.brands (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (length(name) between 2 and 100),
  description text not null default '' check (length(description) <= 4000),
  website text not null default '' check (website = '' or website ~ '^https://'),
  contact_email text not null default '' check (contact_email = '' or contact_email ~ '^[^@ ]+@[^@ ]+\.[^@ ]+$'),
  contact_verified_at timestamptz,
  logo_url text,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.brand_assets (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands(id) on delete cascade,
  provider text not null check (provider in ('apple', 'bluesky', 'youtube')),
  name text not null,
  source_id text not null,
  url text not null check (url ~ '^https://'),
  publisher text,
  icon_url text,
  verified_at timestamptz,
  evidence text,
  created_at timestamptz not null default now(),
  unique (brand_id, provider, source_id)
);

create table if not exists public.scan_runs (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  brand_id uuid not null references public.brands(id) on delete cascade,
  brand_name text not null,
  provider text not null check (provider in ('apple', 'youtube', 'bluesky')),
  country text not null default 'us',
  status text not null default 'Running' check (status in ('Running', 'Completed', 'Partial', 'Failed')),
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  fetched_at timestamptz,
  candidate_count int not null default 0,
  match_count int not null default 0,
  excluded_count int not null default 0,
  cache_hit boolean not null default false,
  error_message text,
  created_at timestamptz not null default now()
);

create table if not exists public.candidates (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  brand_id uuid not null references public.brands(id) on delete cascade,
  scan_id uuid not null references public.scan_runs(id) on delete cascade,
  provider text not null check (provider in ('apple', 'youtube', 'bluesky')),
  source_id text not null,
  name text not null,
  source_url text not null check (source_url ~ '^https://'),
  publisher text,
  description text,
  icon_url text,
  metadata jsonb not null default '{}'::jsonb,
  fetched_at timestamptz not null default now(),
  last_scan_at timestamptz not null default now(),
  official boolean not null default false,
  potential boolean not null default false,
  status text not null default 'Needs Review' check (status in ('Needs Review', 'Under Review', 'Confirmed Impersonation', 'Dismissed')),
  score_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (scan_id, source_id)
);

create table if not exists public.findings (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  candidate_id uuid not null unique references public.candidates(id) on delete cascade,
  score int not null check (score between 0 and 100),
  severity text not null check (severity in ('Low', 'Medium', 'High', 'Critical')),
  status text not null default 'Needs Review' check (status in ('Needs Review', 'Under Review', 'Confirmed Impersonation', 'Dismissed')),
  signals jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.finding_reviews (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  finding_id uuid not null references public.findings(id) on delete cascade,
  reviewer_id uuid not null references auth.users(id),
  status text not null check (status in ('Needs Review', 'Under Review', 'Confirmed Impersonation', 'Dismissed')),
  note text not null check (length(note) between 1 and 8000),
  confirmed boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  candidate_id uuid not null references public.candidates(id) on delete cascade,
  score int not null default 0,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.user_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  alert_threshold int not null default 60 check (alert_threshold between 0 and 100),
  risk_thresholds int[] not null default array[30,60,85],
  retention_days int not null default 90 check (retention_days in (30, 90, 365)),
  updated_at timestamptz not null default now()
);

create index if not exists idx_brands_owner on public.brands(owner_id);
create index if not exists idx_brand_assets_brand on public.brand_assets(brand_id);
create index if not exists idx_scan_runs_brand on public.scan_runs(brand_id, started_at desc);
create index if not exists idx_candidates_brand on public.candidates(brand_id, created_at desc);
create index if not exists idx_findings_scored on public.findings(score, status);
create index if not exists idx_reviews_finding on public.finding_reviews(finding_id, created_at desc);
create index if not exists idx_brands_owner_created on public.brands(owner_id, created_at desc);
create index if not exists idx_brand_assets_brand_created on public.brand_assets(brand_id, created_at desc);
create index if not exists idx_scan_runs_owner_started on public.scan_runs(owner_id, started_at desc);
create index if not exists idx_candidates_owner_created on public.candidates(owner_id, created_at desc);
create index if not exists idx_findings_owner_candidate on public.findings(owner_id, candidate_id);
create index if not exists idx_reviews_owner_finding_created on public.finding_reviews(owner_id, finding_id, created_at);

alter table public.profiles enable row level security;
alter table public.brands enable row level security;
alter table public.brand_assets enable row level security;
alter table public.scan_runs enable row level security;
alter table public.candidates enable row level security;
alter table public.findings enable row level security;
alter table public.finding_reviews enable row level security;
alter table public.notifications enable row level security;
alter table public.user_settings enable row level security;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name, organization_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'display_name', ''), coalesce(new.raw_user_meta_data ->> 'organization_name', ''))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

create policy "profiles_owner" on public.profiles
for all to authenticated
using (id = auth.uid())
with check (id = auth.uid());

create policy "brands_owner" on public.brands
for all to authenticated
using (owner_id = auth.uid())
with check (owner_id = auth.uid());

create policy "brand_assets_owner" on public.brand_assets
for all to authenticated
using (
  exists (
    select 1
    from public.brands b
    where b.id = brand_assets.brand_id and b.owner_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.brands b
    where b.id = brand_assets.brand_id and b.owner_id = auth.uid()
  )
);

create policy "scan_runs_owner" on public.scan_runs
for all to authenticated
using (owner_id = auth.uid())
with check (owner_id = auth.uid());

create policy "candidates_owner" on public.candidates
for all to authenticated
using (owner_id = auth.uid())
with check (owner_id = auth.uid());

create policy "findings_owner" on public.findings
for all to authenticated
using (owner_id = auth.uid())
with check (owner_id = auth.uid());

create policy "finding_reviews_owner" on public.finding_reviews
for all to authenticated
using (owner_id = auth.uid())
with check (owner_id = auth.uid());

create policy "notifications_owner" on public.notifications
for all to authenticated
using (owner_id = auth.uid())
with check (owner_id = auth.uid());

create policy "user_settings_owner" on public.user_settings
for all to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists brands_touch_updated_at on public.brands;
create trigger brands_touch_updated_at
before update on public.brands
for each row execute function public.touch_updated_at();

create or replace function public.upsert_default_settings(p_user_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.user_settings (user_id, alert_threshold, risk_thresholds, retention_days)
  values (p_user_id, 60, array[30,60,85], 90)
  on conflict (user_id) do nothing;
$$;

-- Example: recommended insert for a new user after sign-up in edge functions or client code
-- select public.upsert_default_settings(auth.uid());
