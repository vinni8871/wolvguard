-- Permit YouTube provider records in the active account workspace schema.
-- Run only against a database created from supabase/schema.sql.
alter table public.scan_runs
  drop constraint if exists scan_runs_provider_check;
alter table public.scan_runs
  add constraint scan_runs_provider_check
  check (provider in ('apple', 'youtube', 'bluesky'));

alter table public.candidates
  drop constraint if exists candidates_provider_check;
alter table public.candidates
  add constraint candidates_provider_check
  check (provider in ('apple', 'youtube', 'bluesky'));
