import { jsPDF } from "jspdf";
import type { LiveBrand, LiveCandidate, Scan } from "../components/live/types";

const PAGE_MARGIN = 16;
const PAGE_WIDTH = 210;
const CONTENT_WIDTH = PAGE_WIDTH - PAGE_MARGIN * 2;
const TEAL: [number, number, number] = [25, 153, 133];
const INK: [number, number, number] = [30, 41, 48];
const MUTED: [number, number, number] = [102, 115, 123];
const SEVERITIES = ["Critical", "High", "Medium", "Low"] as const;
const STATUSES = [
  "Needs Review",
  "Under Review",
  "Confirmed Impersonation",
  "Dismissed",
] as const;

export function getScanReportMetrics(scan: Scan) {
  const evidence = scan.evidence ?? [];
  return {
    evidenceCount: evidence.length,
    potentialMatches: evidence.filter((candidate) => candidate.potential).length,
    officialListings: evidence.filter((candidate) => candidate.official).length,
    severityCounts: Object.fromEntries(
      SEVERITIES.map((severity) => [
        severity,
        evidence.filter((candidate) => candidate.severity === severity).length,
      ]),
    ) as Record<(typeof SEVERITIES)[number], number>,
    statusCounts: Object.fromEntries(
      STATUSES.map((status) => [
        status,
        evidence.filter((candidate) => candidate.status === status).length,
      ]),
    ) as Record<(typeof STATUSES)[number], number>,
  };
}

function date(value: string | null) {
  if (!value) return "Not recorded";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? "Date unavailable"
    : new Intl.DateTimeFormat(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(parsed);
}

function percent(value: number | null) {
  return value === null ? "Unavailable" : `${(value * 100).toFixed(1)}%`;
}

function providerName(provider: LiveCandidate["provider"] | Scan["provider"]) {
  switch (provider) {
    case "youtube":
      return "YouTube";
    case "bluesky":
      return "Bluesky";
    case "apple":
    case undefined:
      return "Apple App Store";
  }
}

function addScanChart(
  doc: jsPDF,
  title: string,
  labels: readonly string[],
  counts: Record<string, number>,
  y: number,
) {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...INK);
  doc.text(title, PAGE_MARGIN, y);
  const chartY = y + 9;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  const labelWidth = Math.min(
    62,
    Math.max(38, ...labels.map((label) => doc.getTextWidth(label) + 3)),
  );
  const valueWidth = 12;
  const barWidth = CONTENT_WIDTH - labelWidth - valueWidth;
  const max = Math.max(1, ...labels.map((label) => counts[label] ?? 0));
  labels.forEach((label, index) => {
    const rowY = chartY + index * 9;
    const count = counts[label] ?? 0;
    doc.setTextColor(...MUTED);
    doc.text(label, PAGE_MARGIN, rowY + 3.5);
    doc.setFillColor(231, 237, 237);
    doc.roundedRect(PAGE_MARGIN + labelWidth, rowY, barWidth, 5, 1.5, 1.5, "F");
    if (count) {
      doc.setFillColor(...TEAL);
      doc.roundedRect(
        PAGE_MARGIN + labelWidth,
        rowY,
        Math.max(1.5, (count / max) * barWidth),
        5,
        1.5,
        1.5,
        "F",
      );
    }
    doc.setTextColor(...INK);
    doc.text(String(count), PAGE_MARGIN + labelWidth + barWidth + 4, rowY + 3.5);
  });
}

function ensureSpace(doc: jsPDF, y: number, height: number) {
  if (y + height <= 278) return y;
  doc.addPage();
  return 18;
}

function addCandidate(doc: jsPDF, candidate: LiveCandidate, index: number, y: number) {
  const nameLines = doc.splitTextToSize(candidate.name, CONTENT_WIDTH - 35) as string[];
  const headerHeight = Math.max(8, nameLines.length * 5);
  y = ensureSpace(doc, y, headerHeight + 30);
  doc.setDrawColor(222, 229, 230);
  doc.line(PAGE_MARGIN, y, PAGE_WIDTH - PAGE_MARGIN, y);
  y += 6;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...INK);
  doc.text(`${index + 1}.`, PAGE_MARGIN, y);
  doc.text(nameLines, PAGE_MARGIN + 8, y);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...TEAL);
  doc.text(`Risk indicator ${candidate.score}/100 · ${candidate.severity}`, PAGE_WIDTH - PAGE_MARGIN, y, {
    align: "right",
  });
  y += headerHeight;

  const lines: [string, string][] = [
    ["Publisher / account", candidate.publisher || "Unavailable"],
    ["Provider listing ID", candidate.sourceId || "Unavailable"],
    ["Review status", candidate.status],
    [
      "Classification",
      candidate.official ? "Verified official listing" : candidate.potential ? "Potential match" : "Not classified as a potential match",
    ],
    ["Evidence fetched", date(candidate.fetchedAt)],
    ["Listing URL", candidate.sourceUrl || "Unavailable"],
  ];
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  for (const [label, value] of lines) {
    const wrapped = doc.splitTextToSize(`${label}: ${value}`, CONTENT_WIDTH - 8) as string[];
    y = ensureSpace(doc, y, wrapped.length * 4.2 + 1);
    doc.setTextColor(...MUTED);
    doc.text(wrapped, PAGE_MARGIN + 8, y);
    y += wrapped.length * 4.2;
  }

  if (candidate.description) {
    const description = doc.splitTextToSize(
      `Description: ${candidate.description}`,
      CONTENT_WIDTH - 8,
    ) as string[];
    y = ensureSpace(doc, y, description.length * 4.2 + 2);
    doc.setTextColor(...MUTED);
    doc.text(description, PAGE_MARGIN + 8, y);
    y += description.length * 4.2 + 2;
  }

  y = ensureSpace(doc, y, 10);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...INK);
  doc.text("Signals", PAGE_MARGIN + 8, y);
  y += 4.5;
  doc.setFont("helvetica", "normal");
  for (const signal of candidate.signals) {
    const value =
      signal.code === "METADATA_DIFFERENCE"
        ? signal.value === null
          ? "Unavailable"
          : signal.value === 1
            ? "Difference detected"
            : "No difference detected"
        : percent(signal.value);
    const text = `${signal.label} · ${value} · weight ${signal.weight}%`;
    const wrapped = doc.splitTextToSize(text, CONTENT_WIDTH - 16) as string[];
    y = ensureSpace(doc, y, wrapped.length * 4.2 + 1);
    doc.setTextColor(...MUTED);
    doc.text(wrapped, PAGE_MARGIN + 12, y);
    y += wrapped.length * 4.2;
  }
  return y + 5;
}

export function buildScanReportPdf(scan: Scan): Uint8Array {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const metrics = getScanReportMetrics(scan);
  const evidence = scan.evidence ?? [];

  doc.setProperties({
    title: `WolvGuard scan report - ${scan.brandName}`,
    subject: "Live scan record and captured provider evidence",
    creator: "WolvGuard",
  });
  doc.setFillColor(9, 17, 23);
  doc.rect(0, 0, PAGE_WIDTH, 39, "F");
  doc.setTextColor(106, 228, 205);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text("WOLVGUARD  /  LIVE WORKSPACE", PAGE_MARGIN, 13);
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(20);
  doc.text("Live scan report", PAGE_MARGIN, 24);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(scan.brandName, PAGE_MARGIN, 32);

  let y = 49;
  doc.setTextColor(...INK);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("Scan details", PAGE_MARGIN, y);
  y += 8;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  const details = [
    ["Source", providerName(scan.provider)],
    ["Country / region", scan.country.toUpperCase()],
    ["Status", scan.status],
    ["Started", date(scan.startedAt)],
    ["Completed", date(scan.completedAt)],
    ["Provider retrieval time", date(scan.fetchedAt)],
    ["Listings / potential matches / official identities", `${scan.count} / ${scan.matches} / ${scan.excluded}`],
    ["Listings with saved evidence", String(metrics.evidenceCount)],
    ["Provider response cached", scan.cacheHit ? "Yes" : "No"],
  ];
  details.forEach(([label, value], index) => {
    const x = index % 2 === 0 ? PAGE_MARGIN : PAGE_MARGIN + CONTENT_WIDTH / 2;
    const rowY = y + Math.floor(index / 2) * 13;
    doc.setTextColor(...MUTED);
    doc.text(label, x, rowY);
    doc.setTextColor(...INK);
    doc.text(doc.splitTextToSize(value, CONTENT_WIDTH / 2 - 5), x, rowY + 4);
  });
  y += Math.ceil(details.length / 2) * 13 + 3;
  if (scan.error) {
    doc.setTextColor(160, 67, 47);
    doc.setFont("helvetica", "bold");
    doc.text("Provider note", PAGE_MARGIN, y);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...INK);
    const errorLines = doc.splitTextToSize(scan.error, CONTENT_WIDTH) as string[];
    doc.text(errorLines, PAGE_MARGIN, y + 5);
    y += errorLines.length * 4 + 9;
  }

  y = ensureSpace(doc, y, 58);
  if (evidence.length) {
    addScanChart(doc, "Severity distribution · captured scan evidence", SEVERITIES, metrics.severityCounts, y);
    y += 52;
    y = ensureSpace(doc, y, 48);
    addScanChart(doc, "Review status · captured scan evidence", STATUSES, metrics.statusCounts, y);
    y += 46;
    doc.setFontSize(8);
    doc.setTextColor(...MUTED);
    doc.text(
      `Evidence snapshot totals: ${metrics.evidenceCount} listings, ${metrics.potentialMatches} potential matches, ${metrics.officialListings} verified official listings.`,
      PAGE_MARGIN,
      ensureSpace(doc, y, 8),
    );
    y += 12;
  } else {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(...INK);
    doc.text("No candidate evidence snapshot is available for this scan.", PAGE_MARGIN, y + 6);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...MUTED);
    doc.text(
      "Charts and candidate details are omitted rather than inferred from current workspace data.",
      PAGE_MARGIN,
      y + 13,
    );
  }

  if (evidence.length) {
    doc.addPage();
    y = 18;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(15);
    doc.setTextColor(...INK);
    doc.text("Captured candidate evidence", PAGE_MARGIN, y);
    y += 10;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...MUTED);
    doc.text(
      "Values below are the scan's saved evidence snapshot; unavailable source data is explicitly marked.",
      PAGE_MARGIN,
      y,
    );
    y += 8;
    evidence.forEach((candidate, index) => {
      y = addCandidate(doc, candidate, index, y);
    });
  }

  const pages = doc.getNumberOfPages();
  for (let page = 1; page <= pages; page++) {
    doc.setPage(page);
    doc.setDrawColor(222, 229, 230);
    doc.line(PAGE_MARGIN, 285, PAGE_WIDTH - PAGE_MARGIN, 285);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...MUTED);
    doc.text("Heuristic indicators are not probabilities or automated accusations.", PAGE_MARGIN, 291);
    doc.text(`${page} / ${pages}`, PAGE_WIDTH - PAGE_MARGIN, 291, { align: "right" });
  }

  return new Uint8Array(doc.output("arraybuffer"));
}

export function buildEvidenceReportPdf(
  candidate: LiveCandidate,
  brand: LiveBrand | undefined,
  scan: Scan | undefined,
): Uint8Array {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const provider = candidate.provider ?? "apple";
  doc.setProperties({
    title: `WolvGuard evidence report - ${candidate.name}`,
    subject: "Provider evidence and review history",
    creator: "WolvGuard",
  });
  doc.setFillColor(9, 17, 23);
  doc.rect(0, 0, PAGE_WIDTH, 39, "F");
  doc.setTextColor(106, 228, 205);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text("WOLVGUARD  /  LIVE WORKSPACE", PAGE_MARGIN, 13);
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18);
  doc.text("Evidence & review report", PAGE_MARGIN, 24);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(candidate.name, PAGE_MARGIN, 32);

  let y = 49;
  doc.setTextColor(...INK);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("Provider evidence", PAGE_MARGIN, y);
  y += 8;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  const details: [string, string][] = [
    ["Brand", brand?.name ?? "Unavailable"],
    ["Source", providerName(provider)],
    ["Listing ID", candidate.sourceId || "Unavailable"],
    ["Publisher / account", candidate.publisher || "Unavailable"],
    ["Listing URL", candidate.sourceUrl || "Unavailable"],
    ["Description", candidate.description || "Unavailable"],
    ["Bundle ID", candidate.metadata.bundleId || "Unavailable"],
    ["Handle", candidate.metadata.handle || "Unavailable"],
    ["Version", candidate.metadata.version || "Unavailable"],
    ["Category", candidate.metadata.genre || "Unavailable"],
    [
      "Price",
      candidate.metadata.price === null
        ? "Unavailable"
        : `${candidate.metadata.price} ${candidate.metadata.currency ?? ""}`.trim(),
    ],
    ["Region", candidate.metadata.region || "Unavailable"],
    ["Release date", candidate.metadata.releaseDate || "Unavailable"],
    ["Evidence fetched", date(candidate.fetchedAt)],
    ["Last scanned", date(candidate.lastScanAt)],
    ["Scan status", scan?.status ?? "Unavailable"],
    ["Scan retrieval time", date(scan?.fetchedAt ?? null)],
    ["Risk indicator", `${candidate.score}/100 · ${candidate.severity}`],
    [
      "Classification",
      candidate.official
        ? "Verified official listing"
        : candidate.potential
          ? "Potential match"
          : "Not classified as a potential match",
    ],
    ["Review status", candidate.status],
  ];

  for (const [label, value] of details) {
    const labelWidth = 43;
    const wrapped = doc.splitTextToSize(value, CONTENT_WIDTH - labelWidth) as string[];
    const rowHeight = Math.max(5, wrapped.length * 4.2);
    y = ensureSpace(doc, y, rowHeight + 1);
    doc.setTextColor(...MUTED);
    doc.text(`${label}:`, PAGE_MARGIN, y);
    doc.setTextColor(...INK);
    doc.text(wrapped, PAGE_MARGIN + labelWidth, y);
    y += rowHeight + 1;
  }

  y = ensureSpace(doc, y, 12 + candidate.signals.length * 8);
  y += 4;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...INK);
  doc.text("Signal measurements", PAGE_MARGIN, y);
  y += 7;
  const barLeft = PAGE_MARGIN + 67;
  const barWidth = 91;
  for (const signal of candidate.signals) {
    const value = signal.value;
    y = ensureSpace(doc, y, 8);
    const rowY = y;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...MUTED);
    doc.text(signal.label, PAGE_MARGIN, rowY + 3);
    doc.setDrawColor(222, 229, 230);
    doc.setFillColor(231, 237, 237);
    doc.roundedRect(barLeft, rowY, barWidth, 4, 1, 1, "F");
    if (value !== null) {
      const normalized = Math.max(0, Math.min(1, value));
      if (normalized > 0) {
        doc.setFillColor(...TEAL);
        doc.roundedRect(
          barLeft,
          rowY,
          Math.max(1, normalized * barWidth),
          4,
          1,
          1,
          "F",
        );
      }
      doc.setTextColor(...INK);
      doc.text(
        signal.code === "METADATA_DIFFERENCE"
          ? normalized === 1
            ? "Difference"
            : "No difference"
          : percent(value),
        PAGE_WIDTH - PAGE_MARGIN,
        rowY + 3,
        { align: "right" },
      );
    } else {
      doc.setTextColor(...MUTED);
      doc.text("Unavailable", PAGE_WIDTH - PAGE_MARGIN, rowY + 3, {
        align: "right",
      });
    }
    y += 8;
  }

  if (candidate.imageError) {
    y = ensureSpace(doc, y, 12);
    doc.setFontSize(8);
    doc.setTextColor(...MUTED);
    const lines = doc.splitTextToSize(
      `Logo comparison unavailable: ${candidate.imageError}`,
      CONTENT_WIDTH,
    ) as string[];
    doc.text(lines, PAGE_MARGIN, y);
    y += lines.length * 4 + 2;
  }

  y = ensureSpace(doc, y, 16);
  y += 3;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(...INK);
  doc.text(`Review history (${candidate.reviews.length})`, PAGE_MARGIN, y);
  y += 8;
  if (!candidate.reviews.length) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...MUTED);
    doc.text("No review records are attached to this candidate.", PAGE_MARGIN, y);
    y += 6;
  } else {
    for (const review of candidate.reviews) {
      const noteLines = doc.splitTextToSize(
        review.note || "No note recorded",
        CONTENT_WIDTH - 8,
      ) as string[];
      y = ensureSpace(doc, y, 24 + noteLines.length * 4.2);
      doc.setDrawColor(222, 229, 230);
      doc.line(PAGE_MARGIN, y, PAGE_WIDTH - PAGE_MARGIN, y);
      y += 5;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.setTextColor(...INK);
      doc.text(review.status, PAGE_MARGIN, y);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(...MUTED);
      doc.text(`Reviewed ${date(review.at)}`, PAGE_WIDTH - PAGE_MARGIN, y, {
        align: "right",
      });
      y += 5;
      doc.setFontSize(8);
      doc.setTextColor(...INK);
      doc.text(noteLines, PAGE_MARGIN + 4, y);
      y += noteLines.length * 4.2 + 2;
      doc.setTextColor(...MUTED);
      doc.text(
        `Score at review: ${review.scoreAtReview}/100 · Evidence fetched: ${date(review.evidenceFetchedAt)}`,
        PAGE_MARGIN + 4,
        y,
      );
      y += 7;
    }
  }

  const pages = doc.getNumberOfPages();
  for (let page = 1; page <= pages; page++) {
    doc.setPage(page);
    doc.setDrawColor(222, 229, 230);
    doc.line(PAGE_MARGIN, 285, PAGE_WIDTH - PAGE_MARGIN, 285);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...MUTED);
    doc.text(
      "Risk scores are heuristic indicators, not probabilities or automated accusations.",
      PAGE_MARGIN,
      291,
    );
    doc.text(`${page} / ${pages}`, PAGE_WIDTH - PAGE_MARGIN, 291, {
      align: "right",
    });
  }

  return new Uint8Array(doc.output("arraybuffer"));
}

function downloadPdf(pdf: Uint8Array, name: string) {
  const blob = new Blob([pdf], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function downloadScanReport(scan: Scan) {
  downloadPdf(buildScanReportPdf(scan), `wolvguard-scan-${scan.id}.pdf`);
}

export function downloadEvidenceReport(
  candidate: LiveCandidate,
  brand: LiveBrand | undefined,
  scan: Scan | undefined,
) {
  downloadPdf(
    buildEvidenceReportPdf(candidate, brand, scan),
    `wolvguard-evidence-${candidate.sourceId || candidate.id}.pdf`,
  );
}
