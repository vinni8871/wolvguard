import assert from "node:assert/strict";
import { test } from "node:test";
import type { LiveCandidate, Scan } from "../components/live/types";
import {
  buildEvidenceReportPdf,
  buildScanReportPdf,
  getScanReportMetrics,
} from "./scan-report";

function candidate(overrides: Partial<LiveCandidate> = {}): LiveCandidate {
  return {
    provider: "apple",
    sourceId: "12345",
    name: "Example listing",
    sourceUrl: "https://apps.example.test/id12345",
    publisher: "Example Publisher",
    description: "A real provider listing description.",
    iconUrl: "",
    metadata: {
      bundleId: null,
      version: null,
      genre: null,
      price: null,
      currency: null,
      releaseDate: null,
      region: "us",
    },
    score: 62,
    severity: "High",
    signals: [
      { code: "NAME_SIMILARITY", label: "Name similarity", weight: 35, value: 0.9 },
      { code: "DESCRIPTION_TOKEN_SIMILARITY", label: "Description similarity", weight: 15, value: null },
      { code: "METADATA_DIFFERENCE", label: "Publisher / account difference", weight: 20, value: 1 },
      { code: "LOGO_UNAVAILABLE", label: "Logo similarity", weight: 30, value: null },
    ],
    id: "candidate-1",
    brandId: "brand-1",
    scanId: "scan-1",
    fetchedAt: "2026-10-13T12:00:00.000Z",
    lastScanAt: "2026-10-13T12:00:00.000Z",
    official: false,
    potential: true,
    status: "Needs Review",
    reviews: [],
    ...overrides,
  };
}

function scan(evidence?: LiveCandidate[]): Scan {
  return {
    provider: "apple",
    id: "scan-1",
    brandId: "brand-1",
    brandName: "Example brand",
    country: "us",
    startedAt: "2026-10-13T11:59:00.000Z",
    completedAt: "2026-10-13T12:00:00.000Z",
    fetchedAt: "2026-10-13T12:00:00.000Z",
    status: "Completed",
    count: 9,
    matches: 8,
    excluded: 7,
    cacheHit: false,
    error: null,
    candidateIds: evidence?.map((item) => item.id) ?? [],
    evidence,
  };
}

test("scan report metrics count only the saved evidence snapshot", () => {
  const record = scan([
    candidate(),
    candidate({
      id: "candidate-2",
      potential: false,
      official: true,
      severity: "Low",
      status: "Dismissed",
    }),
  ]);

  assert.deepEqual(getScanReportMetrics(record), {
    evidenceCount: 2,
    potentialMatches: 1,
    officialListings: 1,
    severityCounts: { Critical: 0, High: 1, Medium: 0, Low: 1 },
    statusCounts: {
      "Needs Review": 1,
      "Under Review": 0,
      "Confirmed Impersonation": 0,
      Dismissed: 1,
    },
  });
});

test("scan report PDF is generated with and without evidence snapshots", () => {
  for (const record of [scan([candidate()]), scan()]) {
    const pdf = buildScanReportPdf(record);
    assert.equal(new TextDecoder().decode(pdf.slice(0, 5)), "%PDF-");
    assert.ok(pdf.byteLength > 1000);
  }
});

test("evidence PDF includes only the selected candidate, its scan, and its review history", () => {
  const selected = candidate({
    reviews: [
      {
        id: "review-1",
        status: "Under Review",
        note: "Checked the provider listing against the official brand profile.",
        at: "2026-10-13T13:00:00.000Z",
        scoreAtReview: 62,
        evidenceFetchedAt: "2026-10-13T12:00:00.000Z",
      },
    ],
  });
  const pdf = buildEvidenceReportPdf(
    selected,
    {
      id: "brand-1",
      name: "Example brand",
      website: "https://brand.example.test",
      description: "Official brand description",
      archived: false,
      assets: [],
      createdAt: "2026-01-01T00:00:00.000Z",
    },
    scan([selected]),
  );
  const contents = new TextDecoder().decode(pdf);

  assert.equal(contents.slice(0, 5), "%PDF-");
  assert.ok(contents.includes("Example listing"));
  assert.ok(contents.includes("Checked the provider listing"));
  assert.ok(contents.includes("Under Review"));
  assert.ok(contents.includes("apps.example.test"));
  assert.ok(contents.includes("Apple App Store"));
  assert.ok(contents.includes("Risk indicator"));
  assert.ok(!contents.includes("NAME_SIMILARITY"));
  assert.ok(pdf.byteLength > 1000);
});
