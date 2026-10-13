import type { ImageSignature } from "@/lib/image-signature";
import type { detect } from "@/lib/detection";
export type ReviewStatus =
  "Needs Review" | "Under Review" | "Confirmed Impersonation" | "Dismissed";
export type Asset = {
  provider?: "apple" | "bluesky" | "youtube";
  id: string;
  name: string;
  sourceId: string;
  url: string;
  publisher: string;
  verifiedAt: string | null;
  evidence: string;
};
export type LiveBrand = {
  logo?: { signature: ImageSignature; preview: string };
  id: string;
  name: string;
  website: string;
  description: string;
  archived: boolean;
  assets: Asset[];
  createdAt: string;
};
export type ProviderCandidate = {
  provider?: "apple" | "youtube" | "bluesky";
  imageSignature?: ImageSignature;
  imageError?: string;
  sourceId: string;
  name: string;
  sourceUrl: string;
  publisher: string;
  description: string;
  iconUrl: string;
  metadata: {
    handle?: string;
    bundleId: string | null;
    version: string | null;
    genre: string | null;
    price: number | null;
    currency: string | null;
    releaseDate: string | null;
    region: string;
  };
};
export type LiveCandidate = ProviderCandidate &
  ReturnType<typeof detect> & {
    id: string;
    brandId: string;
    scanId: string;
    fetchedAt: string;
    lastScanAt: string;
    official: boolean;
    potential: boolean;
    status: ReviewStatus;
    reviews: {
      id: string;
      status: ReviewStatus;
      note: string;
      at: string;
      scoreAtReview: number;
      evidenceFetchedAt: string;
    }[];
  };
export type Scan = {
  provider?: "apple" | "youtube" | "bluesky";
  evidence?: LiveCandidate[];
  id: string;
  brandId: string;
  brandName: string;
  country: string;
  startedAt: string;
  completedAt: string | null;
  fetchedAt: string | null;
  status: "Running" | "Completed" | "Partial" | "Failed";
  count: number;
  matches: number;
  excluded: number;
  cacheHit: boolean;
  error: string | null;
  candidateIds: string[];
};
export type LocalAlert = {
  id: string;
  candidateId: string;
  createdAt: string;
  read: boolean;
  score: number;
};
export type LiveState = {
  version: 1;
  brands: LiveBrand[];
  candidates: LiveCandidate[];
  scans: Scan[];
  alerts: LocalAlert[];
  prefs: { threshold: number; thresholds: number[]; retention: number };
};
export type ProviderStatus = {
  bluesky: {
    status: string;
    lastSuccess: string | null;
    lastError: string | null;
  };
  apple: {
    status: string;
    lastSuccess: string | null;
    lastError: string | null;
  };
  youtube: {
    status: string;
    lastSuccess?: string | null;
    lastError?: string | null;
  };
  assistant?: { status: string };
  auth: { status: string };
  email: { status: string };
};
