export const normalize = (s: string) =>
  s
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]/gu, "");
export function similarity(a: string, b: string) {
  a = normalize(a);
  b = normalize(b);
  if (!a || !b) return 0;
  let row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const next = [i];
    for (let j = 1; j <= b.length; j++)
      next[j] = Math.min(
        next[j - 1] + 1,
        row[j] + 1,
        row[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    row = next;
  }
  return 1 - row[b.length] / Math.max(a.length, b.length);
}
const confusables: Record<string, string> = {
  "0": "o",
  "1": "l",
  а: "a",
  е: "e",
  о: "o",
  р: "p",
  с: "c",
  х: "x",
  і: "i",
  Α: "a",
  Ο: "o",
  ο: "o",
  α: "a",
};
export const skeleton = (s: string) =>
  normalize(s).replace(/[01аеорсхіΑΟοα]/g, (c) => confusables[c] || c);
export function nameSimilarity(a: string, b: string) {
  const base = similarity(a, b);
  const lookalike = similarity(skeleton(a), skeleton(b));
  const words = b
    .normalize("NFKC")
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean);
  const token =
    words.some((w) => normalize(w) === normalize(a)) && words.length > 1
      ? 0.95
      : 0;
  return {
    value: Math.max(base, lookalike * 0.98, token),
    code:
      token > base
        ? "BRAND_TOKEN_MATCH"
        : lookalike > base
          ? "LOOKALIKE_CHARACTERS"
          : "NAME_SIMILARITY",
  };
}
export function descriptionSimilarity(a: string, b: string) {
  const tokens = (s: string) =>
    new Set(
      s
        .normalize("NFKC")
        .toLowerCase()
        .match(/[\p{L}\p{N}]{3,}/gu) || [],
    );
  const x = tokens(a),
    y = tokens(b);
  if (!x.size || !y.size) return 0;
  const overlap = [...x].filter((t) => y.has(t)).length;
  return overlap / Math.sqrt(x.size * y.size);
}
export function detect(
  brand: string,
  name: string,
  description?: [string, string],
  metadataMismatch?: boolean,
  thresholds = [30, 60, 85],
  logoSimilarity?: number | null,
) {
  const match = nameSimilarity(brand, name);
  const logo =
    typeof logoSimilarity === "number" && Number.isFinite(logoSimilarity)
      ? Math.max(0, Math.min(1, logoSimilarity))
      : null;
  const signals = [
    {
      code: match.code,
      label: "Name similarity",
      weight: 35,
      value: match.value,
    },
    {
      code: "DESCRIPTION_TOKEN_SIMILARITY",
      label: "Description similarity",
      weight: 15,
      value: description ? descriptionSimilarity(...description) : null,
    },
    {
      code: "METADATA_DIFFERENCE",
      label: "Publisher / account difference",
      weight: 20,
      value: metadataMismatch === undefined ? null : metadataMismatch ? 1 : 0,
    },
    {
      code: logo === null ? "LOGO_UNAVAILABLE" : "LOGO_DHASH_RGB",
      label: "Logo similarity",
      weight: 30,
      value: logo,
    },
  ];
  const available = signals.filter((s) => s.value !== null);
  let score = Math.round(
    (100 * available.reduce((n, s) => n + s.weight * s.value!, 0)) /
      available.reduce((n, s) => n + s.weight, 0),
  );
  if (
    !metadataMismatch &&
    !(description && signals[1].value! > 0.6) &&
    !(logo !== null && logo > 0.85)
  )
    score = Math.min(score, 49, thresholds[1] - 1);
  return {
    score,
    severity:
      score >= thresholds[2]
        ? "Critical"
        : score >= thresholds[1]
          ? "High"
          : score >= thresholds[0]
            ? "Medium"
            : "Low",
    signals,
  };
}
