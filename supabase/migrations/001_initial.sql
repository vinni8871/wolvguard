-- WOLVGUARD single-owner tenancy. Organization sharing is intentionally not enabled.
create extension if not exists pgcrypto;
create table public.profiles(id uuid primary key references auth.users(id) on delete cascade, display_name text not null default '', organization_name text not null default '', created_at timestamptz not null default now());
create table public.brands(id uuid primary key default gen_random_uuid(),owner_id uuid not null references auth.users(id) on delete cascade,name text not null check(length(name) between 2 and 100),description text not null default '' check(length(description)<=4000),website text not null check(website ~ '^https://'),contact_email text not null check(contact_email ~ '^[^@ ]+@[^@ ]+\.[^@ ]+$'),contact_verified_at timestamptz,logo_url text,archived_at timestamptz,created_at timestamptz not null default now(),updated_at timestamptz not null default now());
create table public.official_assets(id uuid primary key default gen_random_uuid(),brand_id uuid not null references public.brands(id) on delete cascade,kind text not null check(kind in ('social','app')),platform text not null,name text not null,publisher text,source_id text,url text not null check(url ~ '^https://'),icon_url text,verified_at timestamptz,verification_evidence text,created_at timestamptz not null default now(),check(verified_at is null or length(verification_evidence)>10));
create table public.scan_runs(id uuid primary key default gen_random_uuid(),brand_id uuid not null references public.brands(id) on delete cascade,provider text not null check(provider in ('youtube','apple')),status text not null default 'Queued' check(status in ('Queued','Running','Completed','Partial','Failed')),data_mode text not null default 'live' check(data_mode='live'),started_at timestamptz not null default now(),completed_at timestamptz,candidate_count int not null default 0 check(candidate_count>=0),finding_count int not null default 0 check(finding_count>=0),error_code text,error_message text);
create table public.candidates(id uuid primary key default gen_random_uuid(),scan_id uuid not null references public.scan_runs(id) on delete cascade,source_id text not null,name text not null,source_url text not null check(source_url ~ '^https://'),publisher text,description text,icon_url text,metadata jsonb not null default '{}'::jsonb,created_at timestamptz not null default now(),unique(scan_id,source_id));
create table public.findings(id uuid primary key default gen_random_uuid(),candidate_id uuid not null unique references public.candidates(id) on delete cascade,score int not null check(score between 0 and 100),severity text not null check(severity in ('Low','Medium','High','Critical')),signals jsonb not null,status text not null default 'Needs Review' check(status in ('Needs Review','Under Review','Confirmed Impersonation','Dismissed')),created_at timestamptz not null default now());
create table public.finding_reviews(id uuid primary key default gen_random_uuid(),finding_id uuid not null references public.findings(id) on delete cascade,reviewer_id uuid not null references auth.users(id),status text not null check(status in ('Needs Review','Under Review','Confirmed Impersonation','Dismissed')),note text not null check(length(note) between 1 and 8000),confirmed boolean not null default false,created_at timestamptz not null default now(),check(status <> 'Confirmed Impersonation' or confirmed));
create table public.notifications(id uuid primary key default gen_random_uuid(),finding_id uuid not null references public.findings(id) on delete cascade,channel text not null check(channel in ('in_app','email')),delivery_status text not null default 'Preview' check(delivery_status in ('Preview','Pending','Accepted','Failed')),provider_message_id text,read_at timestamptz,created_at timestamptz not null default now(),unique(finding_id,channel));
create table public.integration_settings(id uuid primary key default gen_random_uuid(),owner_id uuid not null unique references auth.users(id) on delete cascade,notification_threshold int not null default 60 check(notification_threshold between 0 and 100),risk_thresholds int[] not null default array[30,60,85],retention_days int not null default 90 check(retention_days in (30,90,365)),email_enabled boolean not null default false,created_at timestamptz not null default now(),check(array_length(risk_thresholds,1)=3 and risk_thresholds[1]>=0 and risk_thresholds[1]<risk_thresholds[2] and risk_thresholds[2]<risk_thresholds[3] and risk_thresholds[3]<=100));
create index on public.brands(owner_id);
create index on public.official_assets(brand_id);
create index on public.scan_runs(brand_id,started_at desc);
create unique index one_active_scan_per_provider on public.scan_runs(brand_id,provider) where status in ('Queued','Running');
create index on public.candidates(scan_id);
create index on public.findings(score,status);
create index on public.finding_reviews(finding_id,created_at);
create index on public.notifications(finding_id);
-- Security-invoker ownership helpers: all nested reads are themselves subject to RLS.
create function public.owns_brand(b uuid) returns boolean language sql stable security invoker set search_path=public as $$select exists(select 1 from brands where id=b and owner_id=auth.uid())$$;
create function public.owns_scan(s uuid) returns boolean language sql stable security invoker set search_path=public as $$select exists(select 1 from scan_runs where id=s and owns_brand(brand_id))$$;
create function public.owns_candidate(c uuid) returns boolean language sql stable security invoker set search_path=public as $$select exists(select 1 from candidates where id=c and owns_scan(scan_id))$$;
create function public.owns_finding(f uuid) returns boolean language sql stable security invoker set search_path=public as $$select exists(select 1 from findings where id=f and owns_candidate(candidate_id))$$;
alter table public.profiles enable row level security;alter table public.brands enable row level security;alter table public.official_assets enable row level security;alter table public.scan_runs enable row level security;alter table public.candidates enable row level security;alter table public.findings enable row level security;alter table public.finding_reviews enable row level security;alter table public.notifications enable row level security;alter table public.integration_settings enable row level security;
create policy profile_owner on public.profiles for all to authenticated using(id=auth.uid()) with check(id=auth.uid());
create policy brand_owner on public.brands for all to authenticated using(owner_id=auth.uid()) with check(owner_id=auth.uid());
create policy asset_owner on public.official_assets for all to authenticated using(public.owns_brand(brand_id)) with check(public.owns_brand(brand_id));
create policy scan_owner_read on public.scan_runs for select to authenticated using(public.owns_brand(brand_id));
create policy candidate_owner_read on public.candidates for select to authenticated using(public.owns_scan(scan_id));
create policy finding_owner_read on public.findings for select to authenticated using(public.owns_candidate(candidate_id));
create policy review_owner_read on public.finding_reviews for select to authenticated using(public.owns_finding(finding_id));
create policy review_owner_insert on public.finding_reviews for insert to authenticated with check(public.owns_finding(finding_id) and reviewer_id=auth.uid());
create policy notification_owner_read on public.notifications for select to authenticated using(public.owns_finding(finding_id));
create policy notification_owner_update on public.notifications for update to authenticated using(public.owns_finding(finding_id)) with check(public.owns_finding(finding_id));
create policy settings_owner on public.integration_settings for all to authenticated using(owner_id=auth.uid()) with check(owner_id=auth.uid());
-- Contact verification and notification delivery may only be changed by server code.
revoke update on public.brands from authenticated;
grant update(name,description,website,contact_email,logo_url,archived_at,updated_at) on public.brands to authenticated;
revoke insert on public.brands from authenticated;
grant insert(owner_id,name,description,website,contact_email,logo_url) on public.brands to authenticated;
revoke update on public.notifications from authenticated;
grant update(read_at) on public.notifications to authenticated;
create function public.reset_email_verification() returns trigger language plpgsql set search_path=public as $$begin if new.contact_email is distinct from old.contact_email then new.contact_verified_at=null; end if; new.updated_at=now();return new;end$$;
create trigger brand_email_change before update on public.brands for each row execute function public.reset_email_verification();
-- Append-only review history updates status atomically; clients cannot rewrite history.
create function public.apply_review() returns trigger language plpgsql security definer set search_path=public as $$begin
 if new.reviewer_id<>auth.uid() or not exists(select 1 from findings f join candidates c on c.id=f.candidate_id join scan_runs s on s.id=c.scan_id join brands b on b.id=s.brand_id where f.id=new.finding_id and b.owner_id=auth.uid()) then raise exception 'Not authorized';end if;
 update findings set status=new.status where id=new.finding_id;return new;end$$;
create trigger apply_finding_review after insert on public.finding_reviews for each row execute function public.apply_review();
