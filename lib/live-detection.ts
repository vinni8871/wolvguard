import { detect, similarity } from "./detection";
import { imageSimilarity } from "./image-signature";
import type { LiveBrand, ProviderCandidate } from "../components/live/types";
export function scoreCandidate(
  brand: LiveBrand,
  c: ProviderCandidate,
  thresholds: number[],
) {
  const source = c.provider || "apple";
  const assets = brand.assets.filter(
    (a) => (a.provider || "apple") === source && a.verifiedAt,
  );
  const official = assets.some((a) => a.sourceId === c.sourceId);
  const publishers = assets.filter((a) => a.publisher).map((a) => a.publisher);
  const mismatch =
    c.publisher && publishers.length
      ? publishers.every((p) => similarity(p, c.publisher) < 0.8)
      : undefined;
  const logo = imageSimilarity(brand.logo?.signature, c.imageSignature);
  const scoring = detect(
    brand.name,
    c.name,
    brand.description && c.description
      ? [brand.description.slice(0, 2000), c.description.slice(0, 4000)]
      : undefined,
    mismatch,
    thresholds,
    logo,
  );
  return {
    ...scoring,
    official,
    potential:
      !official &&
      (scoring.signals[0].value! >= 0.35 || (logo !== null && logo >= 0.85)) &&
      scoring.score >= thresholds[0],
  };
}
