-- Older deployments may have only the legacy 001 schema. Create each index
-- only when its table and columns exist; the current schema.sql has all of them.
do $$
begin
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='brands' and column_name='owner_id')
     and exists (select 1 from information_schema.columns where table_schema='public' and table_name='brands' and column_name='created_at') then
    execute 'create index if not exists idx_brands_owner_created on public.brands(owner_id, created_at desc)';
  end if;
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='brand_assets' and column_name='brand_id')
     and exists (select 1 from information_schema.columns where table_schema='public' and table_name='brand_assets' and column_name='created_at') then
    execute 'create index if not exists idx_brand_assets_brand_created on public.brand_assets(brand_id, created_at desc)';
  end if;
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='scan_runs' and column_name='owner_id')
     and exists (select 1 from information_schema.columns where table_schema='public' and table_name='scan_runs' and column_name='started_at') then
    execute 'create index if not exists idx_scan_runs_owner_started on public.scan_runs(owner_id, started_at desc)';
  end if;
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='candidates' and column_name='owner_id')
     and exists (select 1 from information_schema.columns where table_schema='public' and table_name='candidates' and column_name='created_at') then
    execute 'create index if not exists idx_candidates_owner_created on public.candidates(owner_id, created_at desc)';
  end if;
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='findings' and column_name='owner_id')
     and exists (select 1 from information_schema.columns where table_schema='public' and table_name='findings' and column_name='candidate_id') then
    execute 'create index if not exists idx_findings_owner_candidate on public.findings(owner_id, candidate_id)';
  end if;
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='finding_reviews' and column_name='owner_id')
     and exists (select 1 from information_schema.columns where table_schema='public' and table_name='finding_reviews' and column_name='finding_id')
     and exists (select 1 from information_schema.columns where table_schema='public' and table_name='finding_reviews' and column_name='created_at') then
    execute 'create index if not exists idx_reviews_owner_finding_created on public.finding_reviews(owner_id, finding_id, created_at)';
  end if;
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='notifications' and column_name='owner_id')
     and exists (select 1 from information_schema.columns where table_schema='public' and table_name='notifications' and column_name='created_at') then
    execute 'create index if not exists idx_notifications_owner_created on public.notifications(owner_id, created_at desc)';
  end if;
end;
$$;
