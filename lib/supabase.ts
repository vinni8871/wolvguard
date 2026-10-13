import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type {
  LiveBrand,
  LiveCandidate,
  LiveState,
  LocalAlert,
  ReviewStatus,
  Scan,
} from "../components/live/types";

const supabaseUrl =
  import.meta.env.VITE_SUPABASE_URL ||
  "https://lfreaxhmyjgudowgpwde.supabase.co";
const supabasePublishableKey =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || "";

type SupabaseTable = {
  Row: Record<string, unknown>;
  Insert: Record<string, unknown>;
  Update: Record<string, unknown>;
  Relationships: [];
};
type Database = {
  public: {
    Tables: {
      profiles: SupabaseTable;
      brands: SupabaseTable;
      brand_assets: SupabaseTable;
      scan_runs: SupabaseTable;
      candidates: SupabaseTable;
      findings: SupabaseTable;
      finding_reviews: SupabaseTable;
      notifications: SupabaseTable;
      user_settings: SupabaseTable;
    };
    Views: Record<never, never>;
    Functions: Record<never, never>;
    Enums: Record<never, never>;
    CompositeTypes: Record<never, never>;
  };
};

export const hasSupabaseConfig = Boolean(
  supabaseUrl && supabasePublishableKey && supabasePublishableKey !== "your_publishable_anon_key_here",
);

const supabaseGlobal = globalThis as typeof globalThis & {
  __wolvguardSupabase?: SupabaseClient<Database>;
};

export const supabase =
  supabaseGlobal.__wolvguardSupabase ??
  createClient<Database>(supabaseUrl, supabasePublishableKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });

supabaseGlobal.__wolvguardSupabase = supabase;

export async function signInWithPassword(email: string, password: string) {
  if (!hasSupabaseConfig) {
    throw new Error("Supabase publishable key is not configured.");
  }

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) throw error;
  return data;
}

export async function signUpWithPassword(email: string, password: string) {
  if (!hasSupabaseConfig) {
    throw new Error("Supabase publishable key is not configured.");
  }

  const { data, error } = await supabase.auth.signUp({ email, password });

  if (error) throw error;
  return data;
}

export function getAuthErrorMessage(error: unknown, action: "login" | "signup") {
  const message = error instanceof Error ? error.message.toLowerCase() : "";
  const status =
    typeof error === "object" && error !== null && "status" in error
      ? error.status
      : undefined;

  if (status === 429) {
    return action === "signup"
      ? "Supabase is rate-limiting signups or confirmation emails. Wait for the limit to reset, or configure custom SMTP in Supabase Auth."
      : "Supabase is rate-limiting sign-in attempts. Wait a few minutes and try again.";
  }
  if (error instanceof TypeError || /network|fetch failed|offline/.test(message)) {
    return "Could not reach Supabase. Check your internet connection and try again.";
  }
  if (/invalid login credentials|invalid_credentials/.test(message)) {
    return "Email or password is incorrect.";
  }
  if (/already registered|already exists|user_exists|email_exists/.test(message)) {
    return "An account with this email already exists. Try signing in instead.";
  }
  if (/invalid email|email address is invalid/.test(message)) {
    return "Enter a valid email address.";
  }
  if (/password/.test(message) && /weak|short|at least|should|minimum/.test(message)) {
    return "That password is too weak. Choose a longer password.";
  }

  return action === "login"
    ? "Sign-in failed. Check your details and try again."
    : "Account creation failed. Check your details and try again.";
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export function buildWorkspaceState({
  brands,
  scans,
  candidates,
  alerts,
  prefs,
}: {
  brands: LiveBrand[];
  scans: Scan[];
  candidates: LiveCandidate[];
  alerts: LocalAlert[];
  prefs: LiveState["prefs"];
}): LiveState {
  return {
    version: 1,
    brands,
    scans,
    candidates,
    alerts,
    prefs,
  };
}

type BrandRow = {
  id: string;
  name: string;
  website: string;
  description: string;
  logo_url: string | null;
  archived_at: string | null;
  created_at: string;
};
type AssetRow = {
  id: string;
  brand_id: string;
  provider: "apple" | "bluesky" | "youtube";
  name: string;
  source_id: string;
  url: string;
  publisher: string | null;
  verified_at: string | null;
  evidence: string | null;
};
type ScanRow = {
  id: string;
  brand_id: string;
  brand_name: string;
  provider: "apple" | "youtube" | "bluesky";
  country: string;
  status: Scan["status"];
  started_at: string;
  completed_at: string | null;
  fetched_at: string | null;
  candidate_count: number | null;
  match_count: number | null;
  excluded_count: number | null;
  cache_hit: boolean | null;
  error_message: string | null;
};
type ReviewRow = {
  id: string;
  status: ReviewStatus;
  note: string;
  created_at: string;
};
type FindingRow = {
  id: string;
  score: number;
  severity: LiveCandidate["severity"];
  status: ReviewStatus;
  signals: LiveCandidate["signals"];
  finding_reviews: ReviewRow[];
};
type CandidateRow = {
  id: string;
  brand_id: string;
  scan_id: string;
  provider: "apple" | "youtube" | "bluesky";
  source_id: string;
  name: string;
  source_url: string;
  publisher: string | null;
  description: string | null;
  icon_url: string | null;
  metadata: LiveCandidate["metadata"];
  fetched_at: string;
  last_scan_at: string;
  official: boolean;
  potential: boolean;
  status: ReviewStatus;
  score_data: Pick<LiveCandidate, "score" | "severity" | "signals"> | null;
  findings: FindingRow[] | FindingRow | null;
};
type AlertRow = {
  id: string;
  candidate_id: string;
  score: number | null;
  read_at: string | null;
  created_at: string;
};
type SettingsRow = {
  alert_threshold: number;
  risk_thresholds: number[];
  retention_days: number;
};

async function fetchWorkspaceFromSupabase(userId: string): Promise<LiveState> {
  if (!hasSupabaseConfig) throw new Error("Supabase is not configured.");

  const [brandsResult, scansResult, candidatesResult, findingsResult, reviewsResult, alertsResult, settingsResult] = await Promise.all([
    supabase.from("brands").select("id,name,website,description,logo_url,archived_at,created_at").eq("owner_id", userId).order("created_at", { ascending: false }).limit(100),
    supabase.from("scan_runs").select("id,brand_id,brand_name,provider,country,status,started_at,completed_at,fetched_at,candidate_count,match_count,excluded_count,cache_hit,error_message").eq("owner_id", userId).order("started_at", { ascending: false }).limit(200),
    supabase.from("candidates").select("id,brand_id,scan_id,provider,source_id,name,source_url,publisher,description,icon_url,metadata,fetched_at,last_scan_at,official,potential,status,score_data").eq("owner_id", userId).order("created_at", { ascending: false }).limit(500),
    supabase.from("findings").select("id,candidate_id,score,severity,status,signals").eq("owner_id", userId).limit(500),
    supabase.from("finding_reviews").select("id,finding_id,status,note,created_at").eq("owner_id", userId).order("created_at", { ascending: true }).limit(1000),
    supabase.from("notifications").select("id,candidate_id,score,read_at,created_at").eq("owner_id", userId).order("created_at", { ascending: false }).limit(500),
    supabase.from("user_settings").select("alert_threshold,risk_thresholds,retention_days").eq("user_id", userId).maybeSingle(),
  ]);
  const results = [brandsResult, scansResult, candidatesResult, findingsResult, reviewsResult, alertsResult, settingsResult];
  const failure = results.find((result) => result.error)?.error;
  if (failure) throw failure;

  const brandRows = (brandsResult.data ?? []) as unknown as BrandRow[];
  const scanRows = (scansResult.data ?? []) as unknown as ScanRow[];
  const candidateRows = (candidatesResult.data ?? []) as unknown as CandidateRow[];
  const findingRows = (findingsResult.data ?? []) as unknown as (Omit<FindingRow, "finding_reviews"> & { candidate_id: string })[];
  const reviewRows = (reviewsResult.data ?? []) as unknown as (ReviewRow & { finding_id: string })[];
  const alertRows = (alertsResult.data ?? []) as unknown as AlertRow[];
  const settingsRow = settingsResult.data as unknown as SettingsRow | null;
  const brandIds = brandRows.map((brand) => brand.id);
  const assetsResult = brandIds.length
    ? await supabase.from("brand_assets").select("id,brand_id,provider,name,source_id,url,publisher,verified_at,evidence").in("brand_id", brandIds).order("created_at", { ascending: false }).limit(500)
    : { data: [], error: null };
  if (assetsResult.error) throw assetsResult.error;
  const assetRows = (assetsResult.data ?? []) as unknown as AssetRow[];
  const assetsByBrand = new Map<string, LiveBrand["assets"]>();
  for (const asset of assetRows) {
    const assets = assetsByBrand.get(asset.brand_id) ?? [];
    assets.push({
      id: asset.id,
      provider: asset.provider,
      name: asset.name,
      sourceId: asset.source_id,
      url: asset.url,
      publisher: asset.publisher ?? "",
      verifiedAt: asset.verified_at,
      evidence: asset.evidence ?? "",
    });
    assetsByBrand.set(asset.brand_id, assets);
  }
  const findingsByCandidate = new Map(findingRows.map((finding) => [finding.candidate_id, finding]));
  const findingsById = new Map(findingRows.map((finding) => [finding.id, finding]));
  const reviewsByFinding = new Map<string, ReviewRow[]>();
  for (const review of reviewRows) {
    const reviews = reviewsByFinding.get(review.finding_id) ?? [];
    reviews.push(review);
    reviewsByFinding.set(review.finding_id, reviews);
  }
  const brands = brandRows.map((brand) => ({
    id: brand.id,
    name: brand.name,
    website: brand.website,
    description: brand.description,
    archived: Boolean(brand.archived_at),
    createdAt: brand.created_at,
    assets: assetsByBrand.get(brand.id) ?? [],
    logo: brand.logo_url ? { preview: brand.logo_url, signature: { hash: "", clusters: [] } as any } : undefined,
  }));

  const scans = scanRows.map((scan) => ({
    id: scan.id,
    brandId: scan.brand_id,
    brandName: scan.brand_name,
    provider: scan.provider,
    country: scan.country ?? "us",
    startedAt: scan.started_at,
    completedAt: scan.completed_at,
    fetchedAt: scan.fetched_at,
    status: scan.status,
    count: scan.candidate_count ?? 0,
    matches: scan.match_count ?? 0,
    excluded: scan.excluded_count ?? 0,
    cacheHit: Boolean(scan.cache_hit),
    error: scan.error_message ?? null,
    candidateIds: [],
  }));

  const candidates = candidateRows.map((candidate) => {
    const finding = findingsByCandidate.get(candidate.id);
    const reviews = finding ? reviewsByFinding.get(finding.id) ?? [] : [];
    return {
    id: candidate.id,
    brandId: candidate.brand_id,
    scanId: candidate.scan_id,
    provider: candidate.provider,
    sourceId: candidate.source_id,
    name: candidate.name,
    sourceUrl: candidate.source_url,
    publisher: candidate.publisher ?? "",
    description: candidate.description ?? "",
    iconUrl: candidate.icon_url ?? "",
    metadata: candidate.metadata ?? {},
    fetchedAt: candidate.fetched_at,
    lastScanAt: candidate.last_scan_at,
    official: Boolean(candidate.official),
    potential: Boolean(candidate.potential),
    status: finding?.status ?? candidate.status,
    reviews: reviews.map((review: any) => ({
      id: review.id,
      status: review.status,
      note: review.note,
      at: review.created_at,
      scoreAtReview: finding?.score ?? 0,
      evidenceFetchedAt: candidate.fetched_at,
    })),
    ...(candidate.score_data ?? {}),
    score: finding?.score ?? candidate.score_data?.score ?? 0,
    severity: finding?.severity ?? candidate.score_data?.severity ?? "Low",
    signals: finding?.signals ?? candidate.score_data?.signals ?? [],
  };
  });

  const alerts = alertRows.map((alert) => ({
    id: alert.id,
    candidateId: alert.candidate_id,
    createdAt: alert.created_at,
    read: Boolean(alert.read_at),
    score: alert.score ?? 0,
  }));

  return buildWorkspaceState({
    brands,
    scans,
    candidates,
    alerts,
    prefs: {
      threshold: settingsRow?.alert_threshold ?? 60,
      thresholds: settingsRow?.risk_thresholds ?? [30, 60, 85],
      retention: settingsRow?.retention_days ?? 90,
    },
  });
}

const pendingWorkspaceLoads = new Map<string, Promise<LiveState>>();

export function loadWorkspaceFromSupabase(userId: string): Promise<LiveState> {
  const existing = pendingWorkspaceLoads.get(userId);
  if (existing) return existing;
  const request = fetchWorkspaceFromSupabase(userId).finally(() => {
    if (pendingWorkspaceLoads.get(userId) === request) {
      pendingWorkspaceLoads.delete(userId);
    }
  });
  pendingWorkspaceLoads.set(userId, request);
  return request;
}

function changedRows<T extends { id: string }>(
  current: T[],
  previous: T[] = [],
  project: (row: T) => unknown = (row) => row,
) {
  const previousById = new Map(previous.map((row) => [row.id, row]));
  return current.filter(
    (row) =>
      JSON.stringify(project(row)) !==
      JSON.stringify(previousById.has(row.id) ? project(previousById.get(row.id)!) : undefined),
  );
}

function removedIds<T extends { id: string }>(current: T[], previous: T[] = []) {
  const currentIds = new Set(current.map((row) => row.id));
  return previous.filter((row) => !currentIds.has(row.id)).map((row) => row.id);
}

async function checkQueries(queries: PromiseLike<{ error: unknown }>[]) {
  if (!queries.length) return;
  const responses = await Promise.all(queries);
  const failed = responses.find((response) => response.error);
  if (failed?.error) throw failed.error;
}

export async function saveWorkspaceToSupabase(
  userId: string,
  workspace: LiveState,
  previous: LiveState,
) {
  if (!hasSupabaseConfig) throw new Error("Supabase is not configured.");

  const previousBrands = previous.brands;
  const previousAssets = previous.brands.flatMap((brand) =>
    brand.assets.map((asset) => ({ ...asset, brandId: brand.id })),
  );
  const assets = workspace.brands.flatMap((brand) =>
    brand.assets.map((asset) => ({ ...asset, brandId: brand.id })),
  );
  const changedBrands = changedRows(workspace.brands, previousBrands, (brand) => ({
    id: brand.id,
    name: brand.name,
    website: brand.website,
    description: brand.description,
    logo: brand.logo?.preview,
    archived: brand.archived,
    createdAt: brand.createdAt,
  }));
  const changedAssets = changedRows(assets, previousAssets);
  const changedScans = changedRows(workspace.scans, previous.scans);
  const changedCandidates = changedRows(workspace.candidates, previous.candidates);
  const changedAlerts = changedRows(workspace.alerts, previous.alerts);
  const brandPayload = changedBrands.map((brand) => ({
    id: brand.id,
    owner_id: userId,
    name: brand.name,
    description: brand.description,
    website: brand.website,
    logo_url: brand.logo?.preview ?? null,
    archived_at: brand.archived ? new Date().toISOString() : null,
    created_at: brand.createdAt,
    updated_at: new Date().toISOString(),
  }));
  const assetPayload = changedAssets.map((asset) => ({
    id: asset.id,
    brand_id: asset.brandId,
    provider: asset.provider ?? "apple",
    name: asset.name,
    source_id: asset.sourceId,
    url: asset.url,
    publisher: asset.publisher,
    verified_at: asset.verifiedAt,
    evidence: asset.evidence,
  }));
  const scanPayload = changedScans.map((scan) => ({
    id: scan.id,
    owner_id: userId,
    brand_id: scan.brandId,
    brand_name: scan.brandName,
    provider: scan.provider ?? "apple",
    country: scan.country,
    status: scan.status,
    started_at: scan.startedAt,
    completed_at: scan.completedAt,
    fetched_at: scan.fetchedAt,
    candidate_count: scan.count,
    match_count: scan.matches,
    excluded_count: scan.excluded,
    cache_hit: scan.cacheHit,
    error_message: scan.error,
  }));
  const candidatePayload = changedCandidates.map((candidate) => ({
    id: candidate.id,
    owner_id: userId,
    brand_id: candidate.brandId,
    scan_id: candidate.scanId,
    provider: candidate.provider ?? "apple",
    source_id: candidate.sourceId,
    name: candidate.name,
    source_url: candidate.sourceUrl,
    publisher: candidate.publisher,
    description: candidate.description,
    icon_url: candidate.iconUrl,
    metadata: candidate.metadata,
    fetched_at: candidate.fetchedAt,
    last_scan_at: candidate.lastScanAt,
    official: candidate.official,
    potential: candidate.potential,
    status: candidate.status,
    score_data: {
      score: candidate.score,
      severity: candidate.severity,
      signals: candidate.signals,
    },
  }));
  const findingPayload = changedCandidates.map((candidate) => ({
    id: candidate.id,
    owner_id: userId,
    candidate_id: candidate.id,
    score: candidate.score,
    severity: candidate.severity,
    status: candidate.status,
    signals: candidate.signals ?? {},
  }));
  const previousReviewIds = new Set(
    previous.candidates.flatMap((candidate) => candidate.reviews.map((review) => review.id)),
  );
  const reviewPayload = workspace.candidates.flatMap((candidate) =>
    candidate.reviews
      .filter((review) => !previousReviewIds.has(review.id))
      .map((review) => ({
        id: review.id,
        owner_id: userId,
        finding_id: candidate.id,
        reviewer_id: userId,
        status: review.status,
        note: review.note,
        confirmed: review.status === "Confirmed Impersonation",
        created_at: review.at,
      })),
  );
  const alertPayload = changedAlerts.map((alert) => ({
    id: alert.id,
    owner_id: userId,
    candidate_id: alert.candidateId,
    created_at: alert.createdAt,
    read_at: alert.read ? alert.createdAt : null,
    score: alert.score,
  }));

  await checkQueries([
    ...(brandPayload.length
      ? [supabase.from("brands").upsert(brandPayload, { onConflict: "id" })]
      : []),
    ...(assetPayload.length
      ? [supabase.from("brand_assets").upsert(assetPayload, { onConflict: "id" })]
      : []),
    ...(scanPayload.length
      ? [supabase.from("scan_runs").upsert(scanPayload, { onConflict: "id" })]
      : []),
  ]);
  await checkQueries([
    ...(candidatePayload.length
      ? [supabase.from("candidates").upsert(candidatePayload, { onConflict: "id" })]
      : []),
  ]);
  await checkQueries([
    ...(findingPayload.length
      ? [supabase.from("findings").upsert(findingPayload, { onConflict: "candidate_id" })]
      : []),
    ...(reviewPayload.length
      ? [supabase.from("finding_reviews").upsert(reviewPayload, { onConflict: "id", ignoreDuplicates: true })]
      : []),
    ...(alertPayload.length
      ? [supabase.from("notifications").upsert(alertPayload, { onConflict: "id" })]
      : []),
    ...(JSON.stringify(workspace.prefs) !== JSON.stringify(previous.prefs)
      ? [supabase.from("user_settings").upsert({
          user_id: userId,
          alert_threshold: workspace.prefs.threshold,
          risk_thresholds: workspace.prefs.thresholds,
          retention_days: workspace.prefs.retention,
          updated_at: new Date().toISOString(),
        }, { onConflict: "user_id" })]
      : []),
  ]);

  const removedBrands = removedIds(workspace.brands, previous.brands);
  const removedAssets = removedIds(assets, previousAssets);
  const removedScans = removedIds(workspace.scans, previous.scans);
  const removedCandidates = removedIds(workspace.candidates, previous.candidates);
  const removedAlerts = removedIds(workspace.alerts, previous.alerts);
  await checkQueries([
    ...(removedAlerts.length
      ? [supabase.from("notifications").delete().in("id", removedAlerts)]
      : []),
    ...(removedCandidates.length
      ? [supabase.from("findings").delete().in("candidate_id", removedCandidates).eq("owner_id", userId)]
      : []),
    ...(removedCandidates.length
      ? [supabase.from("candidates").delete().in("id", removedCandidates).eq("owner_id", userId)]
      : []),
    ...(removedScans.length
      ? [supabase.from("scan_runs").delete().in("id", removedScans).eq("owner_id", userId)]
      : []),
    ...(removedAssets.length
      ? [supabase.from("brand_assets").delete().in("id", removedAssets)]
      : []),
    ...(removedBrands.length
      ? [supabase.from("brands").delete().in("id", removedBrands).eq("owner_id", userId)]
      : []),
  ]);
}
